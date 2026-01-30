import type { Response } from "express";
import type { AuthRequest } from "../types/index.js";
import { client } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { checkUserOnline } from "../services/redis.js";
import { produceMessage, connectProducer } from "../services/kafka.js";
import { randomUUID } from "crypto";

// Trigger restart

// Get or Create Conversation
const getOrCreateConversation = async (userId: string, friendId: string) => {
  // Ensure consistent ordering of IDs so we always find the same conversation
  // regardless of who started it
  const ids = [userId, friendId].sort();
  const userOneId = ids[0] as string;
  const userTwoId = ids[1] as string;

  // Check if conversation exists
  let conversation = await client.conversation.findUnique({
    where: {
      userOneId_userTwoId: {
        userOneId,
        userTwoId,
      },
    },
  });

  // If not exists, create new conversation
  if (!conversation) {
    conversation = await client.conversation.create({
      data: {
        userOneId,
        userTwoId,
      },
    });
  }

  return conversation;
};

// Get All Conversations (DM List)
export const getConversations = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    // Get all friends
    const friends = await client.friend.findMany({
      where: { userId },
      select: { friendId: true },
    });

    const friendIds = friends.map((f: any) => f.friendId);

    if (friendIds.length === 0) {
      return res.status(200).json({
        success: true,
        conversations: [],
      });
    }

    // Get conversations where user is participant
    const conversationsRaw = await client.conversation.findMany({
      where: {
        OR: [
          { userOneId: userId },
          { userTwoId: userId },
        ],
      },
      include: {
        userOne: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          }
        },
        userTwo: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          }
        },
      }
    });

    // Map to frontend format
    const conversations = await Promise.all(
      conversationsRaw.map(async (conversation: any) => {
        // Determine which user is the "other" participant
        const isUserOne = conversation.userOneId === userId;
        const participant = isUserOne ? conversation.userTwo : conversation.userOne;
        const participantId = participant.id;

        // Check Online Status
        const isOnline = await checkUserOnline(participantId);
        participant.status = isOnline ? "online" : "offline";

        // Get last message
        const lastMessage = await client.directMessage.findFirst({
          where: {
            conversationId: conversation.id,
            deleted: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
          },
        });

        // Count unread messages
        const unreadCount = await client.directMessage.count({
          where: {
            conversationId: conversation.id,
            receiverId: userId,
            read: false,
            deleted: false,
          },
        });

        return {
          id: conversation.id,
          conversationId: conversation.id,
          participantId: participantId,
          participant: participant,
          lastMessage,
          unreadCount,
          updatedAt: conversation.updatedAt,
        };
      })
    );

    // Sort by last message time
    conversations.sort((a: any, b: any) => {
      const timeA = a.lastMessage?.createdAt || a.updatedAt;
      const timeB = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    res.status(200).json({
      success: true,
      conversations,
    });
  }
);

// Get Messages in a Conversation
export const getConversationMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.userId;
    const { limit = 50, cursor } = req.query;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
    }

    // Verify conversation access
    const conversation = await client.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const whereClause: any = {
      conversationId,
      deleted: false,
    };

    if (cursor) {
      whereClause.createdAt = {
        lt: new Date(cursor as string),
      };
    }

    const messages = await client.directMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
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
      orderBy: {
        createdAt: "desc",
      },
      take: Number(limit),
    });

    // Mark messages as read
    await client.directMessage.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === Number(limit),
    });
  }
);

// Send Direct Message
export const sendDirectMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { friendId } = req.params;
    const { content, fileUrl } = req.body;
    const senderId = req.userId;

    if (!senderId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!friendId) {
      throw new AppError("Friend ID is required", 400);
    }

    if (!content && !fileUrl) {
      throw new AppError("Message content or file is required", 400);
    }

    // Check if users are friends
    const friendship = await client.friend.findFirst({
      where: {
        userId: senderId,
        friendId,
      },
    });

    if (!friendship) {
      throw new AppError("You can only send messages to friends", 403);
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(senderId, friendId);

    // Generate message ID
    const messageId = randomUUID();
    const createdAt = new Date();

    // Get sender info for response
    const sender = await client.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    // Get receiver info for response
    const receiver = await client.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    // Prepare message payload for Kafka
    const messagePayload = {
      id: messageId,
      content: content || "",
      fileUrl: fileUrl || undefined,
      userId: senderId,
      receiverId: friendId,
      conversationId: conversation.id,
      updatedAt: createdAt,
      sender,
      createdAt,
    };

    // Ensure Kafka producer is connected
    await connectProducer()

    // Publish to Kafka
    produceMessage("chat-messages", conversation.id, {
      type: "DIRECT_MESSAGE",
      payload: messagePayload,
    }).catch((error) => {
      console.error("Failed to publish direct message:", error);
    });

    // Return response immediately (optimistic response)
    const message = {
      id: messageId,
      content: content || "",
      fileUrl: fileUrl || undefined,
      senderId,
      receiverId: friendId,
      conversationId: conversation.id,
      createdAt,
      sender,
      receiver,
    };

    res.status(201).json({
      success: true,
      message,
    });
  }
);

// Delete Direct Message
export const deleteDirectMessage = catchAsync(
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
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("You can only delete your own messages", 403);
    }

    await client.directMessage.update({
      where: { id: messageId },
      data: { deleted: true },
    });

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  }
);

// Mark Messages as Read
export const markMessagesAsRead = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
    }

    const result = await client.directMessage.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.count} messages marked as read`,
    });
  }
);

// Get Unread Message Count
export const getUnreadCount = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const unreadCount = await client.directMessage.count({
      where: {
        receiverId: userId,
        read: false,
        deleted: false,
      },
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  }
);
