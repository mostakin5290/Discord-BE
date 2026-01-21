import { client } from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export class DMService {
  static async getOrCreateConversation(userId: string, friendId: string) {
    if (userId === friendId) {
      throw new AppError("Cannot create conversation with yourself", 400);
    }

    const [id1, id2] = [userId, friendId].sort() as [string, string];

    let conversation = await client.conversation.findFirst({
      where: {
        OR: [
          { userOneId: id1, userTwoId: id2 },
          { userOneId: id2, userTwoId: id1 },
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
            bio: true,
            streamChannelId: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            bio: true,
            streamChannelId: true,
          },
        },
        directMessages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!conversation) {
      const isFriend = await client.friend.findFirst({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      });

      if (!isFriend) {
        throw new AppError("You can only message friends", 403);
      }

      conversation = await client.conversation.create({
        data: {
          userOneId: id1,
          userTwoId: id2,
        },
        include: {
          userOne: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              bio: true,
              streamChannelId: true,
            },
          },
          userTwo: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              bio: true,
              streamChannelId: true,
            },
          },
          directMessages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });
    }

    return conversation;
  }

  static async getAllConversations(userId: string) {
    const conversations = await client.conversation.findMany({
      where: {
        OR: [{ userOneId: userId }, { userTwoId: userId }],
      },
      include: {
        userOne: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            bio: true,
            streamChannelId: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            bio: true,
            streamChannelId: true,
          },
        },
        directMessages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return conversations;
  }

  static async getMessages(
    conversationId: string,
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
    },
  ) {
    const limit = options.limit || 50;

    const conversation = await client.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    if (
      conversation.userOneId !== userId &&
      conversation.userTwoId !== userId
    ) {
      throw new AppError("You don't have access to this conversation", 403);
    }

    const whereClause: any = {
      conversationId,
      deleted: false,
    };

    if (options.cursor) {
      whereClause.createdAt = {
        lt: new Date(options.cursor),
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return {
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    };
  }

  static async sendMessage(
    conversationId: string,
    userId: string,
    data: {
      content?: string;
      fileUrl?: string;
    },
  ) {
    if (!data.content && !data.fileUrl) {
      throw new AppError("Message content or file is required", 400);
    }

    const conversation = await client.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    if (
      conversation.userOneId !== userId &&
      conversation.userTwoId !== userId
    ) {
      throw new AppError("You don't have access to this conversation", 403);
    }

    const receiverId =
      conversation.userOneId === userId
        ? conversation.userTwoId
        : conversation.userOneId;

    const message = await client.directMessage.create({
      data: {
        content: data.content ?? "",
        fileUrl: data.fileUrl ?? null,
        conversationId,
        senderId: userId,
        receiverId,
      },
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
      },
    });

    await client.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        lastMessageId: message.id,
      },
    });

    return message;
  }

  static async updateMessage(
    messageId: string,
    userId: string,
    content: string,
  ) {
    if (!content.trim()) {
      throw new AppError("Message content cannot be empty", 400);
    }

    const message = await client.directMessage.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.senderId !== userId) {
      throw new AppError("You can only edit your own messages", 403);
    }

    if (message.deleted) {
      throw new AppError("Cannot edit a deleted message", 400);
    }

    const updatedMessage = await client.directMessage.update({
      where: { id: messageId },
      data: {
        content,
      },
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
      },
    });

    return updatedMessage;
  }

  static async deleteMessage(messageId: string, userId: string) {
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
      data: {
        deleted: true,
        content: "[This message was deleted]",
      },
    });

    return { message: "Message deleted successfully" };
  }

  static async deleteConversation(conversationId: string, userId: string) {
    const conversation = await client.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    if (
      conversation.userOneId !== userId &&
      conversation.userTwoId !== userId
    ) {
      throw new AppError("You don't have access to this conversation", 403);
    }

    await client.conversation.delete({
      where: { id: conversationId },
    });

    return { message: "Conversation deleted successfully" };
  }
}
