import type { Response } from "express";
import client from "../config/db.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { getIO } from "../socket.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

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
    const { content } = req.body;
    const userId = req.userId!;
    const file = req.file;

    let fileUrl = "";

    if (file) {
      fileUrl = await uploadToCloudinary(file.buffer);
    }

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
            bannerUrl: true,
          },
        },
      },
    });

    // Broadcast message via socket
    try {
      const io = getIO();
      if (io) {
        io.to(channelId).emit("receive_message", message);
      }
    } catch (error) {
      console.error("Socket error:", error);
      // Don't fail the request if socket fails
    }

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

export const searchMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { query, channelId } = req.query;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 25;

    if (!query || typeof query !== 'string') {
      throw new AppError("Search query is required", 400);
    }

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    // Verify user has access to this server
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: {
          where: { userId },
        },
        channels: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!server || server.members.length === 0) {
      throw new AppError("Server not found or you don't have access", 404);
    }

    // Build where clause
    const whereClause: any = {
      deleted: false,
      content: {
        contains: query,
        mode: 'insensitive',
      },
      channel: {
        serverId: serverId,
      },
    };

    // If specific channel is provided, filter by channel
    if (channelId && typeof channelId === 'string') {
      whereClause.channelId = channelId;
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
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    res.status(200).json({
      success: true,
      results: messages,
      count: messages.length,
      query,
    });
  }
);

