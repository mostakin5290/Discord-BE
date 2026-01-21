import type { Response } from "express";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { DMService } from "../services/dm.service.js";
import { getIO } from "../socket.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const getOrCreateConversation = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { friendId } = req.params;
    const userId = req.userId!;

    if (!friendId) {
      throw new AppError("Friend ID is required", 400);
    }

    const conversation = await DMService.getOrCreateConversation(
      userId,
      friendId,
    );

    res.status(200).json({
      success: true,
      conversation,
    });
  },
);

export const getAllConversations = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const conversations = await DMService.getAllConversations(userId);

    res.status(200).json({
      success: true,
      conversations,
    });
  },
);

export const getMessages = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string;

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
    }

    const result = await DMService.getMessages(conversationId, userId, {
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
    const { conversationId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
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

    const message = await DMService.sendMessage(
      conversationId,
      userId,
      messageData,
    );

    const io = getIO();
    io.to(`conversation:${conversationId}`).emit("dm:new", message);

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

    const message = await DMService.updateMessage(messageId, userId, content);

    const io = getIO();
    io.emit("dm:updated", message);

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

    const result = await DMService.deleteMessage(messageId, userId);

    const io = getIO();
    io.emit("dm:deleted", { messageId });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const deleteConversation = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { conversationId } = req.params;
    const userId = req.userId!;

    if (!conversationId) {
      throw new AppError("Conversation ID is required", 400);
    }

    const result = await DMService.deleteConversation(conversationId, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);
