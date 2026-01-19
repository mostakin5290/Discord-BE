import type { Response } from "express";
import type { AuthRequest } from "../types/index.js";
import { client } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { getIO } from "../socket.js";

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

    // Determine receiver (the person who sent the original message, unless it was me, then the other participant)
    // Actually, in a DM, a reply is just a new message in the same conversation, but with a replyToId.
    // The receiver logic is the same as sending a normal message.
    
    // We need to know who the 'friend' is.
    // If I am the sender of the original message, I am replying to myself?
    // No, usually I am replying to the OTHER person in the conversation.
    // If I reply to my own message, the receiver is still the other person.
    
    // So we need to find the conversation and the OTHER participant.
    const conversation = await client.conversation.findUnique({
        where: { id: replyToMessage.conversationId },
        include: { userOne: true, userTwo: true }
    });

    if (!conversation) {
        throw new AppError("Conversation not found", 404);
    }

    // Identify the receiver.
    // Conversation has `userId` (creator) and `participantId` (other).
    // If req.userId === conversation.userId, receiver is participantId.
    // If req.userId === conversation.participantId, receiver is userId.
    
    // BUT, `getOrCreateConversation` logic in dm.controller.ts sets `participantId` as the OTHER person relative to the creator.
    // Wait, the schema says:
    // userId (String) - NOT in conversation model directly?
    // Conversation model: `participantId` and `directMessages`.
    // Actually `Conversation` model in schema:
    /*
      model Conversation {
        id               String          @id @default(cuid())
        participantId    String
        participant      User            @relation("ConversationParticipant", fields: [participantId], references: [id], onDelete: Cascade)
        // ...
      }
    */
    // This schema is a bit weird for DMs (usually 1:1 needs two user IDs).
    // Let's look at `dm.controller.ts` `getOrCreateConversation` again.
    /*
      where: {
        AND: [
          { participantId: { in: [userId, friendId] } },
          { OR: [{ participantId: userId }, { participantId: friendId }] } // This logic seems flawed if it only tracks one participant?
        ]
      }
    */
    // Wait, `getOrCreateConversation` uses `participantId` to match EITHER user?
    // If I create a conversation with Bob, `participantId` = Bob.
    // If Bob creates one with me, `participantId` = Me.
    // But `Conversation` only has ONE `participantId`.
    // Where is the OTHER user? 
    // Ah, `directMessages` have `senderId` and `receiverId`.
    
    // Let's rely on the original message's sender and receiver to figure out who to send the reply to.
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

    // Determine the event name. It's just a new message, but with reply info.
    // The frontend listens to "direct_message_received" or "direct_message_sent".
    // Or we can use "reply_received".
    // Existing frontend uses `handleIncomingMessage` for `direct_message_received`.
    // `replyToMessage` thunk expects the response.
    
    // Let's emit `direct_message_received` so it shows up as a new message.
    getIO().to(receiverId).emit("direct_message_received", newMessage);
    getIO().to(userId).emit("direct_message_sent", newMessage);
    
    // We ALSO added `updateMessage` listener for `replyToMessage.fulfilled`.
    // So the interaction is covered.

    res.status(201).json({
      success: true,
      message: newMessage,
    });
  }
);
