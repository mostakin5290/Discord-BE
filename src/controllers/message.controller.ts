import type { Response } from "express";
import client from "../config/db.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";

export const getChannelMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string;

    if (!channelId) {
      throw new AppError("Channel ID is required", 400);
    }

    // Verify user has access to this channel
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

    if (cursor) {
      whereClause.createdAt = {
        lt: new Date(cursor),
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

    res.status(200).json({
      success: true,
      messages: messages.reverse(),
      hasMore: messages.length === limit,
    });
  }
);

export const sendMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;
    const { content, fileUrl } = req.body;
    const userId = req.userId!;

    if (!content && !fileUrl) {
      throw new AppError("Message content or file is required", 400);
    }

    if (!channelId) {
      throw new AppError("Channel ID is required", 400);
    }

    // Verify user has access to this channel
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
        content: content || "",
        fileUrl,
        channelId: channelId,
        userId: userId,
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

    res.status(201).json({
      success: true,
      message,
    });
  }
);

export const deleteMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const userId = req.userId!;

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const message = await client.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.userId !== userId) {
      throw new AppError("You can only delete your own messages", 403);
    }

    await client.message.update({
      where: { id: messageId },
      data: { deleted: true },
    });

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  }
);
