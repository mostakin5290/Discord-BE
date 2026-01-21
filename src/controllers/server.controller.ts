import type { Response } from "express";
import { CreateServerSchema } from "../types/index.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { ServerService } from "../services/server.service.js";
import { getIO } from "../socket.js";

export const createServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { success, data } = CreateServerSchema.safeParse(req.body);

    if (!success) {
      throw new AppError("Invalid data", 400);
    }

    const userId = req.userId!;

    const imageUrl = data?.imageUrl || undefined;
    const bio = data?.bio || undefined;

    const server = await ServerService.createServer({
      name: data?.name ?? "",
      ...(imageUrl && { imageUrl }),
      ...(bio && { bio }),
      userId,
    });

    res.status(201).json({
      success: true,
      message: "Server created successfully",
      server,
    });
  },
);

export const getUserServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const servers = await ServerService.getUserServers(userId);

    res.status(200).json({
      success: true,
      servers,
    });
  },
);

export const getServerById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const server = await ServerService.getServerById(serverId, userId);

    res.status(200).json({
      success: true,
      server,
    });
  },
);

export const updateServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { name, bannerUrl, imageUrl, bio } = req.body;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const server = await ServerService.updateServer(serverId, userId, {
      name,
      bannerUrl,
      imageUrl,
      bio,
    });

    const io = getIO();
    io.to(`server:${serverId}`).emit("server:updated", server);

    res.status(200).json({
      success: true,
      message: "Server updated successfully",
      server,
    });
  },
);

export const deleteServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const result = await ServerService.deleteServer(serverId, userId);

    const io = getIO();
    io.to(`server:${serverId}`).emit("server:deleted", { serverId });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const joinServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { inviteCode } = req.body;
    const userId = req.userId!;

    if (!inviteCode) {
      throw new AppError("Invite code is required", 400);
    }

    const server = await ServerService.joinServer(inviteCode, userId);

    if (!server) {
      throw new AppError("Failed to join server", 500);
    }

    const io = getIO();
    io.to(`server:${server.id}`).emit("member:joined", {
      serverId: server.id,
      userId,
    });

    res.status(200).json({
      success: true,
      message: "Successfully joined the server",
      server,
    });
  },
);

export const leaveServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const result = await ServerService.leaveServer(serverId, userId);

    const io = getIO();
    io.to(`server:${serverId}`).emit("member:left", {
      serverId,
      userId,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const inviteCodeJoin = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { invitecode, serverId } = req.params;

    if (!serverId || !invitecode) {
      throw new AppError("Server ID & InviteCode is required", 400);
    }

    const server = await ServerService.joinServer(invitecode, userId);

    const io = getIO();
    io.to(`server:${serverId}`).emit("member:joined", {
      serverId,
      userId,
    });

    res.status(200).json({
      success: true,
      message: "Member added to server",
      server,
    });
  },
);

export const createChannel = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { name, type } = req.body;
    const userId = req.userId!;

    if (!serverId || !name) {
      throw new AppError("Server ID and channel name are required", 400);
    }

    const channel = await ServerService.createChannel(serverId, userId, {
      name,
      type: type || "TEXT",
    });

    const io = getIO();
    io.to(`server:${serverId}`).emit("channel:created", channel);

    res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
    });
  },
);

export const deleteChannel = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;
    const userId = req.userId!;

    if (!channelId) {
      throw new AppError("Channel ID is required", 400);
    }

    const result = await ServerService.deleteChannel(channelId, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const updateChannel = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { channelId } = req.params;
    const { name, type } = req.body;
    const userId = req.userId!;

    if (!channelId) {
      throw new AppError("Channel ID is required", 400);
    }

    const channel = await ServerService.updateChannel(channelId, userId, {
      name,
      type,
    });

    res.status(200).json({
      success: true,
      message: "Channel updated successfully",
      channel,
    });
  },
);

export const regenerateInviteCode = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const result = await ServerService.regenerateInviteCode(serverId, userId);

    res.status(200).json({
      success: true,
      message: "Invite code regenerated successfully",
      ...result,
    });
  },
);

export const getServerChannels = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const channels = await ServerService.getServerChannels(serverId, userId);

    res.status(200).json({
      success: true,
      channels,
    });
  },
);
