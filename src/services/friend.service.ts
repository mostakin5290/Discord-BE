import { client } from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export class FriendService {
  static async sendFriendRequest(senderId: string, username: string) {
    const recipient = await client.user.findUnique({
      where: { username },
    });

    if (!recipient) {
      throw new AppError("User not found", 404);
    }

    if (recipient.id === senderId) {
      throw new AppError("You cannot send a friend request to yourself", 400);
    }

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
              imageUrl: true,
              bio: true,
            },
          },
        },
      });
    } else {
      friendRequest = await client.friendRequest.create({
        data: {
          senderId,
          receiverId: recipient.id,
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
              imageUrl: true,
              bio: true,
            },
          },
        },
      });
    }

    return friendRequest;
  }

  static async getPendingRequests(userId: string) {
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
            bio: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return requests;
  }

  static async acceptFriendRequest(requestId: string, userId: string) {
    const request = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError("Friend request not found", 404);
    }

    if (request.receiverId !== userId) {
      throw new AppError("You can only accept requests sent to you", 403);
    }

    if (request.status !== "PENDING") {
      throw new AppError("This request is not pending", 400);
    }

    await client.$transaction([
      client.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      }),
      client.friend.create({
        data: {
          userId: request.senderId,
          friendId: request.receiverId,
        },
      }),
      client.friend.create({
        data: {
          userId: request.receiverId,
          friendId: request.senderId,
        },
      }),
    ]);

    return { message: "Friend request accepted" };
  }

  static async rejectFriendRequest(requestId: string, userId: string) {
    const request = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError("Friend request not found", 404);
    }

    if (request.receiverId !== userId) {
      throw new AppError("You can only reject requests sent to you", 403);
    }

    await client.friendRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    return { message: "Friend request rejected" };
  }

  static async cancelFriendRequest(requestId: string, userId: string) {
    const request = await client.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new AppError("Friend request not found", 404);
    }

    if (request.senderId !== userId) {
      throw new AppError("You can only cancel your own requests", 403);
    }

    if (request.status !== "PENDING") {
      throw new AppError("Can only cancel pending requests", 400);
    }

    await client.friendRequest.delete({
      where: { id: requestId },
    });

    return { message: "Friend request cancelled" };
  }

  static async getFriends(userId: string) {
    const friends = await client.friend.findMany({
      where: { userId },
      include: {
        friend: {
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
      },
    });

    return friends.map((f) => f.friend);
  }

  static async removeFriend(friendId: string, userId: string) {
    const friendship = await client.friend.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new AppError("Friendship not found", 404);
    }

    await client.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    return { message: "Friend removed successfully" };
  }

  static async blockUser(userId: string, blockUserId: string) {
    if (userId === blockUserId) {
      throw new AppError("You cannot block yourself", 400);
    }

    await client.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId: blockUserId },
          { userId: blockUserId, friendId: userId },
        ],
      },
    });

    await client.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: blockUserId },
          { senderId: blockUserId, receiverId: userId },
        ],
      },
    });

    return { message: "User blocked successfully" };
  }

  static async unblockUser(userId: string, blockedUserId: string) {
    return { message: "User unblocked successfully" };
  }

  static async getBlockedUsers(userId: string) {
    return [];
  }

  static async getSentRequests(userId: string) {
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
      orderBy: { createdAt: "desc" },
    });

    return requests;
  }

  static async getUserProfile(userId: string, currentUserId: string) {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        bannerUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const friendship = await client.friend.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: userId },
          { userId: userId, friendId: currentUserId },
        ],
      },
    });

    const pendingRequest = await client.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: userId, status: "PENDING" },
          { senderId: userId, receiverId: currentUserId, status: "PENDING" },
        ],
      },
    });

    return {
      ...user,
      isFriend: !!friendship,
      hasPendingRequest: !!pendingRequest,
    };
  }

  static async getMutualFriends(userId: string, targetUserId: string) {
    const userFriends = await client.friend.findMany({
      where: { userId },
      select: { friendId: true },
    });

    const targetFriends = await client.friend.findMany({
      where: { userId: targetUserId },
      select: { friendId: true },
    });

    const userFriendIds = userFriends.map((f) => f.friendId);
    const targetFriendIds = targetFriends.map((f) => f.friendId);

    const mutualFriendIds = userFriendIds.filter((id) =>
      targetFriendIds.includes(id),
    );

    const mutualFriends = await client.user.findMany({
      where: { id: { in: mutualFriendIds } },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    return mutualFriends;
  }

  static async getMutualServers(userId: string, targetUserId: string) {
    const userMembers = await client.member.findMany({
      where: { userId },
      select: { serverId: true },
    });

    const targetMembers = await client.member.findMany({
      where: { userId: targetUserId },
      select: { serverId: true },
    });

    const userServerIds = userMembers.map((m) => m.serverId);
    const targetServerIds = targetMembers.map((m) => m.serverId);

    const mutualServerIds = userServerIds.filter((id) =>
      targetServerIds.includes(id),
    );

    const mutualServers = await client.server.findMany({
      where: { id: { in: mutualServerIds } },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    });

    return mutualServers;
  }
}
