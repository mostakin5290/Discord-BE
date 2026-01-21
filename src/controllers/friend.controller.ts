import type { Response } from "express";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { FriendService } from "../services/friend.service.js";
import { getIO } from "../socket.js";

export const sendFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { username } = req.body;
    const senderId = req.userId;

    if (!senderId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!username) {
      throw new AppError("Username is required", 400);
    }

    const friendRequest = await FriendService.sendFriendRequest(
      senderId,
      username,
    );

    const io = getIO();
    io.to(`user:${friendRequest.receiverId}`).emit(
      "friendRequest:new",
      friendRequest,
    );

    res.status(201).json({
      success: true,
      message: "Friend request sent successfully",
      friendRequest,
    });
  },
);

export const getPendingRequests = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const requests = await FriendService.getPendingRequests(userId);

    res.status(200).json({
      success: true,
      requests,
    });
  },
);

export const acceptFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId!;

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    const result = await FriendService.acceptFriendRequest(requestId, userId);

    const io = getIO();
    io.emit("friendRequest:accepted", { requestId });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const rejectFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId!;

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    const result = await FriendService.rejectFriendRequest(requestId, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const cancelFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId!;

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    const result = await FriendService.cancelFriendRequest(requestId, userId);

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const getFriends = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const friends = await FriendService.getFriends(userId);

    res.status(200).json({
      success: true,
      friends,
    });
  },
);

export const removeFriend = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { friendId } = req.params;
    const userId = req.userId!;

    if (!friendId) {
      throw new AppError("Friend ID is required", 400);
    }

    const result = await FriendService.removeFriend(friendId, userId);

    const io = getIO();
    io.to(`user:${friendId}`).emit("friend:removed", { userId });
    io.to(`user:${userId}`).emit("friend:removed", { friendId });

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const blockUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const { userId: blockUserId } = req.body;
  const userId = req.userId!;

  if (!blockUserId) {
    throw new AppError("User ID is required", 400);
  }

  const result = await FriendService.blockUser(userId, blockUserId);

  res.status(200).json({
    success: true,
    ...result,
  });
});

export const unblockUser = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: blockedUserId } = req.params;
    const userId = req.userId!;

    if (!blockedUserId) {
      throw new AppError("User ID is required", 400);
    }

    const result = await FriendService.unblockUser(userId, blockedUserId);

    res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const getBlockedUsers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const blockedUsers = await FriendService.getBlockedUsers(userId);

    res.status(200).json({
      success: true,
      blockedUsers,
    });
  },
);

export const getSentRequests = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const sentRequests = await FriendService.getSentRequests(userId);

    res.status(200).json({
      success: true,
      sentRequests,
    });
  },
);

export const getUserProfile = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId!;

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    const profile = await FriendService.getUserProfile(
      targetUserId,
      currentUserId,
    );

    res.status(200).json({
      success: true,
      profile,
    });
  },
);

export const getMutualFriends = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId!;

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    const mutualFriends = await FriendService.getMutualFriends(
      currentUserId,
      targetUserId,
    );

    res.status(200).json({
      success: true,
      mutualFriends,
    });
  },
);

export const getMutualServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId!;

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    const mutualServers = await FriendService.getMutualServers(
      currentUserId,
      targetUserId,
    );

    res.status(200).json({
      success: true,
      mutualServers,
    });
  },
);
