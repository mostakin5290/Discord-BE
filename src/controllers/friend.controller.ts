import type { Response } from "express";
import type { AuthRequest } from "../types/index.js";
import { client } from "../config/db.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { getIO } from "../socket.js";

// Send Friend Request
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

    // Find recipient by username
    const recipient = await client.user.findUnique({
      where: { username },
    });

    if (!recipient) {
      throw new AppError("User not found", 404);
    }

    if (recipient.id === senderId) {
      throw new AppError("You cannot send a friend request to yourself", 400);
    }

    // Check if already friends
    const existingFriend = await client.friend.findFirst({
      where: {
        OR: [
          { userId: senderId, friendId: recipient.id },
          { userId: recipient.id, friendId: senderId },
        ],
      },
    });

    if (existingFriend) {
      throw new AppError("You are already friends", 400);
    }

    // Check if request already exists (any status)
    const existingRequest = await client.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: recipient.id,
        },
      },
    });

    let friendRequest;

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        throw new AppError("Friend request already sent", 400);
      }
      if (existingRequest.status === "ACCEPTED") {
        // If request is ACCEPTED but no friendship exists, it means they unfriended.
        // We should switch it back to PENDING to allow re-friending.
        friendRequest = await client.friendRequest.update({
          where: { id: existingRequest.id },
          data: { status: "PENDING" },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                bio: true,
              },
            },
            receiver: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                bio: true,
              },
            },
          },
        });
      }

      // If rejected, allow resending by updating status
      friendRequest = await client.friendRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: "PENDING",
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              imageUrl: true,
              bio: true,
            },
          },
          receiver: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
              bio: true,
            },
          },
        },
      });
    } else {
      // Create friend request
      friendRequest = await client.friendRequest.create({
        data: {
          senderId,
          receiverId: recipient.id,
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
          receiver: {
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
    }

    // Check for inverse request (they sent one to me)
    const inverseRequest = await client.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId: recipient.id,
          receiverId: senderId,
        },
      },
    });

    if (inverseRequest && inverseRequest.status === "PENDING") {
      // Auto-accept simple case or just notify user?
      // For now, let's just warn or let them handle it via UI (Accept button) which is better UX.
      // But the UI shows "Already sent you a request" via toast, so we good.
    }

    // Emit Socket Events
    getIO().to(recipient.id).emit("friend_request_received", friendRequest);
    getIO().to(senderId).emit("friend_request_sent", friendRequest);

    res.status(201).json({
      success: true,
      message: "Friend request sent successfully",
      friendRequest,
    });
  },
);

// Accept Friend Request
export const acceptFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    // Find the friend request
    const friendRequest = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new AppError("Friend request not found", 404);
    }

    if (friendRequest.receiverId !== userId) {
      throw new AppError("You are not authorized to accept this request", 403);
    }

    if (friendRequest.status !== "PENDING") {
      throw new AppError("This request has already been processed", 400);
    }

    // Update request status and create friendship
    const [updatedRequest, friendship1, friendship2] =
      await client.$transaction([
        client.friendRequest.update({
          where: { id: requestId },
          data: { status: "ACCEPTED" },
        }),
        client.friend.create({
          data: {
            userId: friendRequest.senderId,
            friendId: friendRequest.receiverId,
          },
          include: {
            friend: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                bio: true,
              },
            },
          },
        }),
        client.friend.create({
          data: {
            userId: friendRequest.receiverId,
            friendId: friendRequest.senderId,
          },
          include: {
            friend: {
              select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                bio: true,
              },
            },
          },
        }),
      ]);

    // Emit Socket Events
    // Notify sender that receiver accepted
    getIO().to(friendRequest.senderId).emit("friend_request_accepted", {
      requestId,
      friend: friendship1, // Contains the receiver as 'friend'
    });

    // Notify receiver (current user) - usually unnecessary via socket if api returns it, but good for consistency
    getIO().to(friendRequest.receiverId).emit("friend_request_accepted", {
      requestId,
      friend: friendship2, // Contains the sender as 'friend'
    });

    res.status(200).json({
      success: true,
      message: "Friend request accepted",
      friendRequest: updatedRequest,
      newFriend: friendship2,
    });
  },
);

// Reject Friend Request
export const rejectFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    const friendRequest = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new AppError("Friend request not found", 404);
    }

    if (friendRequest.receiverId !== userId) {
      throw new AppError("You are not authorized to reject this request", 403);
    }

    if (friendRequest.status !== "PENDING") {
      throw new AppError("This request has already been processed", 400);
    }

    await client.friendRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    getIO()
      .to(friendRequest.senderId)
      .emit("friend_request_rejected", { requestId });

    res.status(200).json({
      success: true,
      message: "Friend request rejected",
    });
  },
);

// Get Pending Friend Requests
export const getPendingRequests = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const requests = await client.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: "PENDING",
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
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      requests,
    });
  },
);

// Get All Friends
export const getFriends = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    // console.log("Fetching friends for user:", userId);

    // Fetch associations where user is EITHER sender OR receiver of friendship
    // This handles cases where 1-way record exists (corruption) or normal 2-way
    const friendships = await client.friend.findMany({
      where: {
        OR: [{ userId: userId }, { friendId: userId }],
      },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            bio: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            bio: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      // distinct: ['userId', 'friendId'] // REMOVING DISTINCT FOR DEBUG
    });

    // console.log(`[DEBUG] Friends Raw Count: ${friendships.length}`);
    if (friendships.length > 0) {
      // console.log(`[DEBUG] First Friendship: ${JSON.stringify(friendships[0], null, 2)}`);
    } else {
      // console.log(`[DEBUG] No friendships found for user ${userId}. Checking DB directly or logic error.`);
    }

    // Normalize: Ensure 'friend' prop is always the OTHER person
    const friends = friendships.map((record: any) => {
      // If I am userId, then record.friend is the friend.
      if (record.userId === userId) {
        return record;
      }

      // If I am friendId, then record.user is the friend.
      // We flip it so frontend sees consistent structure.
      return {
        ...record,
        userId: userId, // Pretend I am userId
        friendId: record.userId, // The other person is friendId
        friend: record.user, // The other person's profile
        user: record.friend, // Me
      };
    });

    // Deduplicate: If we have BOTH (A,B) and (B,A), we might get duplicates after normalization if we aren't careful.
    // However, findMany OR returns distinct records.
    // (A,B) -> Normalized to (A,B)
    // (B,A) -> Normalized to (A,B)
    // So we need to deduplicate by friendId.
    const uniqueFriendsMap = new Map();
    friends.forEach((f) => {
      if (!uniqueFriendsMap.has(f.friendId)) {
        uniqueFriendsMap.set(f.friendId, f);
      }
    });

    const uniqueFriends = Array.from(uniqueFriendsMap.values());

    // console.log(`Found ${uniqueFriends.length} unique friends for user ${userId}`);
    res.status(200).json({
      success: true,
      friends: uniqueFriends,
    });
  },
);

// Remove Friend
export const removeFriend = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { friendId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!friendId) {
      throw new AppError("Friend ID is required", 400);
    }

    // Delete both friendship records
    await client.$transaction([
      client.friend.deleteMany({
        where: {
          userId,
          friendId,
        },
      }),
      client.friend.deleteMany({
        where: {
          userId: friendId,
          friendId: userId,
        },
      }),
    ]);

    getIO().to(friendId).emit("friend_removed", { friendId: userId });

    res.status(200).json({
      success: true,
      message: "Friend removed successfully",
    });
  },
);

// Cancel Friend Request
export const cancelFriendRequest = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { requestId } = req.params;
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!requestId) {
      throw new AppError("Request ID is required", 400);
    }

    const friendRequest = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new AppError("Friend request not found", 404);
    }

    if (friendRequest.senderId !== userId) {
      throw new AppError("You are not authorized to cancel this request", 403);
    }

    if (friendRequest.status !== "PENDING") {
      throw new AppError("This request has already been processed", 400);
    }

    await client.friendRequest.delete({
      where: { id: requestId },
    });

    getIO()
      .to(friendRequest.receiverId)
      .emit("friend_request_cancelled", { requestId });

    res.status(200).json({
      success: true,
      message: "Friend request cancelled",
    });
  },
);

// Get Sent Friend Requests
export const getSentRequests = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const requests = await client.friendRequest.findMany({
      where: {
        senderId: userId,
        status: "PENDING",
      },
      include: {
        receiver: {
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
    });

    res.status(200).json({
      success: true,
      requests,
    });
  },
);

// Get User Profile by ID
export const getUserProfile = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    const user = await client.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        imageUrl: true,
        bannerUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    res.status(200).json({
      success: true,
      user,
    });
  },
);

// Get Mutual Friends
export const getMutualFriends = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    // Get current user's friends
    const myFriends = await client.friend.findMany({
      where: {
        OR: [{ userId: currentUserId }, { friendId: currentUserId }],
      },
      select: {
        userId: true,
        friendId: true,
      },
    });

    // Extract friend IDs
    const myFriendIds = myFriends.map((f) =>
      f.userId === currentUserId ? f.friendId : f.userId,
    );

    // Get target user's friends
    const targetUserFriends = await client.friend.findMany({
      where: {
        OR: [{ userId: targetUserId }, { friendId: targetUserId }],
      },
      select: {
        userId: true,
        friendId: true,
      },
    });

    // Extract target user's friend IDs
    const targetFriendIds = targetUserFriends.map((f) =>
      f.userId === targetUserId ? f.friendId : f.userId,
    );

    // Find mutual friend IDs
    const mutualFriendIds = myFriendIds.filter((id) =>
      targetFriendIds.includes(id),
    );

    // Fetch mutual friends' details
    const mutualFriends = await client.user.findMany({
      where: {
        id: { in: mutualFriendIds },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    res.status(200).json({
      success: true,
      mutualFriends,
      count: mutualFriends.length,
    });
  },
);

// Get Mutual Servers
export const getMutualServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401);
    }

    if (!targetUserId) {
      throw new AppError("User ID is required", 400);
    }

    // Get servers where both users are members
    const mutualServers = await client.server.findMany({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: currentUserId,
              },
            },
          },
          {
            members: {
              some: {
                userId: targetUserId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        bio: true,
      },
    });

    res.status(200).json({
      success: true,
      mutualServers,
      count: mutualServers.length,
    });
  },
);
