import client from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export class MessageService {
  static async getChannelMessages(
    channelId: string,
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
    },
  ) {
    const limit = options.limit || 50;

    const channel = await client.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!channel || channel.server.members.length === 0) {
      throw new AppError("Channel not found or you don't have access", 404);
    }

    const whereClause: any = {
      channelId: channelId,
      deleted: false,
    };

    if (options.cursor) {
      whereClause.createdAt = {
        lt: new Date(options.cursor),
      };
    }

    const messages = await client.message.findMany({
      where: whereClause,
      include: {
        user: {
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
    channelId: string,
    userId: string,
    data: {
      content?: string;
      fileUrl?: string;
    },
  ) {
    if (!data.content && !data.fileUrl) {
      throw new AppError("Message content or file is required", 400);
    }

    const channel = await client.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!channel || channel.server.members.length === 0) {
      throw new AppError("Channel not found or you don't have access", 404);
    }

    const message = await client.message.create({
      data: {
        content: data.content ?? "",
        fileUrl: data.fileUrl ?? null,
        channelId,
        userId,
      },
      include: {
        user: {
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

    const message = await client.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.userId !== userId) {
      throw new AppError("You can only edit your own messages", 403);
    }

    if (message.deleted) {
      throw new AppError("Cannot edit a deleted message", 400);
    }

    const updatedMessage = await client.message.update({
      where: { id: messageId },
      data: {
        content,
      },
      include: {
        user: {
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
    const message = await client.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            server: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const member = message.channel.server.members[0];
    const isOwner = message.userId === userId;
    const isAdmin = member?.role === "ADMIN";
    const isModerator = member?.role === "MODERATOR";

    if (!isOwner && !isAdmin && !isModerator) {
      throw new AppError(
        "You don't have permission to delete this message",
        403,
      );
    }

    await client.message.update({
      where: { id: messageId },
      data: {
        deleted: true,
        content: "[This message was deleted]",
      },
    });

    return { message: "Message deleted successfully" };
  }

  static async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await client.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            server: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.channel.server.members.length === 0) {
      throw new AppError("You don't have access to this channel", 403);
    }

    const reactions = (message.reactions as any) || {};

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const userIndex = reactions[emoji].indexOf(userId);

    if (userIndex > -1) {
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }

      await client.message.update({
        where: { id: messageId },
        data: { reactions },
      });

      return { action: "removed" };
    }

    reactions[emoji].push(userId);

    await client.message.update({
      where: { id: messageId },
      data: { reactions },
    });

    return { action: "added" };
  }

  static async getMessageReactions(messageId: string) {
    const message = await client.message.findUnique({
      where: { id: messageId },
      select: { reactions: true },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const reactions = (message.reactions as any) || {};
    const result = [];

    for (const [emoji, userIds] of Object.entries(reactions)) {
      const users = await client.user.findMany({
        where: {
          id: {
            in: userIds as string[],
          },
        },
        select: {
          id: true,
          username: true,
          imageUrl: true,
        },
      });

      result.push({
        emoji,
        count: users.length,
        users,
      });
    }

    return result;
  }

  static async searchMessages(
    serverId: string,
    userId: string,
    searchQuery: string,
  ) {
    // Verify user is member of the server
    const member = await client.member.findFirst({
      where: {
        serverId,
        userId,
      },
    });

    if (!member) {
      throw new AppError("You are not a member of this server", 403);
    }

    // Get all channels in the server
    const channels = await client.channel.findMany({
      where: { serverId },
      select: { id: true },
    });

    const channelIds = channels.map((c) => c.id);

    // Search messages in all channels
    const messages = await client.message.findMany({
      where: {
        channelId: { in: channelIds },
        deleted: false,
        content: {
          contains: searchQuery,
          mode: "insensitive",
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit results
    });

    return messages;
  }
}
