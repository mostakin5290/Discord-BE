import type { Response } from "express";
import type { AuthRequest } from "../../types/index.js";
import { client } from "../../config/db.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import { getIO } from "../../socket.js";

// Pin Message
export const pinMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const message = await client.directMessage.findUnique({
      where: { id: messageId as string },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Only sender or receiver can pin
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new AppError("Not authorized to pin this message", 403);
    }

    const updatedMessage = await client.directMessage.update({
      where: { id: messageId as string },
      data: {
        pinned: !message.pinned,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
      },
    });

    // Emit socket event
    const eventName = updatedMessage.pinned ? "message_pinned" : "message_unpinned";
    getIO().to(message.senderId).emit(eventName, updatedMessage);
    getIO().to(message.receiverId).emit(eventName, updatedMessage);

    res.status(200).json({
      success: true,
      message: updatedMessage.pinned ? "Message pinned" : "Message unpinned",
      data: updatedMessage,
    });
  }
);

// Delete Message
export const deleteMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { deleteType } = req.query; // "forMe" | "forEveryone"
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const message = await client.directMessage.findUnique({
      where: { id: messageId as string },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Only sender or receiver can delete
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new AppError("Not authorized to delete this message", 403);
    }

    let updatedMessage;

    if (deleteType === "forEveryone") {
      // Only sender can delete for everyone
      if (message.senderId !== userId) {
        throw new AppError("Only sender can delete for everyone", 403);
      }

      updatedMessage = await client.directMessage.update({
        where: { id: messageId as string },
        data: { deleted: true },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              imageUrl: true,
            },
          },
        },
      });

      // Socket event for everyone
      getIO().to(message.senderId).emit("message_deleted", { messageId, deleteType: "forEveryone" });
      getIO().to(message.receiverId).emit("message_deleted", { messageId, deleteType: "forEveryone" });
    } else {
      // Delete for me only - use deletedBy array
      const currentDeletedBy = message.deletedBy || [];
      if (!currentDeletedBy.includes(userId)) {
        currentDeletedBy.push(userId);
      }

      updatedMessage = await client.directMessage.update({
        where: { id: messageId as string },
        data: { deletedBy: currentDeletedBy },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              imageUrl: true,
            },
          },
        },
      });

      // Socket event only for this user
      getIO().to(userId).emit("message_deleted", { messageId, deleteType: "forMe" });
   }

    res.status(200).json({
      success: true,
      message: "Message deleted",
      data: updatedMessage,
    });
  }
);

// Add Reaction
export const addReaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!emoji) {
      throw new AppError("Emoji is required", 400);
    }

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const message = await client.directMessage.findUnique({
      where: { id: messageId as string },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Get existing reactions
    const reactions = (message.reactions as any) || {};
    
    // Initialize emoji array if it doesn't exist
    if (!reactions[emoji as string]) {
      reactions[emoji as string] = [];
    }

    // Add user to emoji array if not already there
    if (!reactions[emoji as string].includes(userId)) {
      reactions[emoji as string].push(userId);
    }

    const updatedMessage = await client.directMessage.update({
      where: { id: messageId as string },
      data: { reactions },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
      },
    });

    // Emit socket event
    getIO().to(message.senderId).emit("reaction_added", { messageId, emoji, userId, reactions });
    getIO().to(message.receiverId).emit("reaction_added", { messageId, emoji, userId, reactions });

    res.status(200).json({
      success: true,
      message: "Reaction added",
      data: updatedMessage,
    });
  }
);

// Remove Reaction
export const removeReaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId, emoji } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!messageId || !emoji) {
      throw new AppError("Message ID and emoji are required", 400);
    }

    const message = await client.directMessage.findUnique({
      where: { id: messageId as string },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Get existing reactions
    const reactions = (message.reactions as any) || {};

    // Remove user from emoji array
    if (reactions[emoji as string] && Array.isArray(reactions[emoji as string])) {
      reactions[emoji as string] = reactions[emoji as string].filter((id: string) => id !== userId);
      
      // Remove emoji key if no users left
      if (reactions[emoji as string].length === 0) {
        delete reactions[emoji as string];
      }
    }

    const updatedMessage = await client.directMessage.update({
      where: { id: messageId as string },
      data: { reactions },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
      },
    });

    // Emit socket event
    getIO().to(message.senderId).emit("reaction_removed", { messageId, emoji, userId, reactions });
    getIO().to(message.receiverId).emit("reaction_removed", { messageId, emoji, userId, reactions });

    res.status(200).json({
      success: true,
      message: "Reaction removed",
      data: updatedMessage,
    });
  }
);
// Reply to Message
export const replyToMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { content, fileUrl } = req.body;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!messageId) {
      throw new AppError("Message ID to reply to is required", 400);
    }

    if (!content && !fileUrl) {
      throw new AppError("Content or file is required", 400);
    }

    const replyToMessage = await client.directMessage.findUnique({
      where: { id: messageId as string },
    });

    if (!replyToMessage) {
      throw new AppError("Message to reply to not found", 404);
    }

    // Determine receiver from the original message
    let receiverId;
    if (replyToMessage.senderId === userId) {
        // I sent the original message. I am replying to the receiver of the original message.
        receiverId = replyToMessage.receiverId;
    } else {
        // Someone else sent it. I am replying to them.
        receiverId = replyToMessage.senderId;
    }

    const newMessage = await client.directMessage.create({
      data: {
        content: content || "",
        fileUrl,
        senderId: userId,
        receiverId: receiverId,
        conversationId: replyToMessage.conversationId,
        replyToId: messageId as string,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            imageUrl: true,
          },
        },
        replyTo: {
             select: {
                id: true,
                content: true,
                sender: {
                    select: {
                        username: true,
                        imageUrl: true,
                    }
                }
             }
        }
      },
    });

    // Update conversation
    await client.conversation.update({
        where: { id: replyToMessage.conversationId },
        data: {
            lastMessageAt: new Date(),
            lastMessageId: newMessage.id,
            updatedAt: new Date(),
        },
    });

    getIO().to(receiverId).emit("direct_message_received", newMessage);
    getIO().to(userId).emit("direct_message_sent", newMessage);

    res.status(201).json({
      success: true,
      message: newMessage,
    });
  }
);
