import type { Response } from "express";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { MessageService } from "../services/message.service.js";
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

    const result = await MessageService.getChannelMessages(channelId, userId, {
      limit,
      cursor,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const sendMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    if (!channelId) {
      throw new AppError("Channel ID is required", 400);
    }

    let fileUrl: string | undefined;
    let fileType: string | undefined;

    if (req.file) {
      const uploadResult: any = await uploadToCloudinary(req.file.buffer);
      fileUrl = uploadResult.secure_url || uploadResult;
      fileType = req.file.mimetype.startsWith("image") ? "image" : "file";
    }

    const messageData: { content?: string; fileUrl?: string } = {};
    if (content) messageData.content = content;
    if (fileUrl) messageData.fileUrl = fileUrl;

    const message = await MessageService.sendMessage(
      channelId,
      userId,
      messageData,
    );

    const io = getIO();
    io.to(`channel:${channelId}`).emit("message:new", message);

    res.status(201).json({
      success: true,
      message,
    });
  },
);

export const updateMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    if (!messageId || !content) {
      throw new AppError("Message ID and content are required", 400);
    }

    const message = await MessageService.updateMessage(
      messageId,
      userId,
      content,
    );

    const io = getIO();
    io.emit("message:updated", message);

    res.status(200).json({
      success: true,
      message,
    });
  },
);

export const deleteMessage = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const userId = req.userId!;

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const result = await MessageService.deleteMessage(messageId, userId);

    const io = getIO();
    io.emit("message:deleted", { messageId });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const addReaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId!;

    if (!messageId || !emoji) {
      throw new AppError("Message ID and emoji are required", 400);
    }

    const result = await MessageService.addReaction(messageId, userId, emoji);

    const io = getIO();
    io.emit("reaction:updated", { messageId, userId, emoji, ...result });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const getMessageReactions = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const reactions = await MessageService.getMessageReactions(messageId);

    res.status(200).json({
      success: true,
      reactions,
    });
  },
);

export const searchMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { query } = req.query;
    const userId = req.userId!;

    if (!serverId || !query || typeof query !== "string") {
      throw new AppError("Server ID and search query are required", 400);
    }

    const messages = await MessageService.searchMessages(
      serverId,
      userId,
      query,
    );

    res.status(200).json({
      success: true,
      messages,
    });
  },
);
