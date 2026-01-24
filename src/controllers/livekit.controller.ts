import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { AccessToken } from "livekit-server-sdk";
import type { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import client from "../config/db.js";
import { getIO } from "../socket.js";
import { env } from "../config/env.js";

export const createToken = async ({
  roomName,
  participantName,
  participantIdentity,
}: {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}) => {
  const apiKey = env.LIVEKIT.API_KEY;
  const apiSecret = env.LIVEKIT.API_SECRET;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity || participantName,
    name: participantName,
    ttl: "12h",
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return { token };
};

export const createDirectCallToken = catchAsync(
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        roomName,
        participantName,
        participantIdentity,
        friendId,
        channelType,
      } = await req.body;
      const userId = req.userId;

      if (!roomName || !participantName) {
        return res
          .status(400)
          .json({
            error: "Missing required fields: roomName, participantName",
          });
      }

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!friendId) {
        throw new AppError("Friend ID is required", 400);
      }

      const friend = await client.user.findUnique({
        where: { id: friendId },
      });

      if (!friend) {
        throw new AppError("Friend not found", 404);
      }

      const { token } = await createToken({
        roomName,
        participantName,
        participantIdentity,
      });

      // Generate a separate token for the friend to join the same room
      const { token: friendToken } = await createToken({
        roomName,
        participantName: friend.username,
        participantIdentity: friendId,
      });

      // Check if friend is connected to socket before emitting
      const io = getIO();
      const friendRoom = io.sockets.adapter.rooms.get(friendId);
      const isFriendConnected = friendRoom && friendRoom.size > 0;

      // console.log(`Call: Attempting to call friend ${friendId} (${friend.username})`);
      // console.log(`Call: Friend is ${isFriendConnected ? 'connected' : 'not connected'} to socket`);

      if (isFriendConnected) {
        io.to(friendId).emit("incoming_call", {
          token: friendToken,
          roomName,
          fromFriendId: userId,
          fromFriendName: participantName,
          channelType: channelType,
        });
        // console.log(`Call: Incoming call event emitted to friend ${friendId}`);
      } else {
        console.warn(
          `Call: Friend ${friendId} is not connected to socket. Call notification not sent.`,
        );
        // You might want to return an error or handle this case differently
        // For now, we'll still return success but log the warning
      }

      return res.status(200).json({ token, roomName, channelType });
    } catch (error) {
      console.error("Error generating token:", error);
      return res.status(500).json({ error: "Failed to generate token" });
    }
  },
);

export const createGroupCallToken = catchAsync(
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        roomName,
        participantName,
        participantIdentity,
        channelId,
        serverId,
      } = await req.body;
      const userId = req.userId;

      if (!roomName || !participantName) {
        return res
          .status(400)
          .json({
            error: "Missing required fields: roomName, participantName",
          });
      }

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { token } = await createToken({
        roomName,
        participantName,
        participantIdentity,
      });

      const addUserToChannel = await client.user.update({
        where: { id: userId },
        data: {
          streamChannelId: channelId,
        },
      });

      // getIO().to(userId).emit("user_joined_room", { token, roomName, fromFriendId: userId, fromFriendName: participantName });

      return res.status(200).json({ token });
    } catch (error) {
      console.error("Error generating token:", error);
      return res.status(500).json({ error: "Failed to generate token" });
    }
  },
);

export const removeUserFromChannel = catchAsync(
  async (req: AuthRequest, res: Response) => {
    try {
      const { channelId, serverId } = await req.body;
      const userId = req.userId;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!channelId || !serverId) {
        throw new AppError("Channel ID and server ID are required", 400);
      }

      const removeUserFromChannel = await client.user.update({
        where: { id: userId },
        data: {
          streamChannelId: null,
        },
      });
      if (!removeUserFromChannel) {
        throw new AppError("Failed to remove user from channel", 400);
      }

      return res.status(200).json({ message: "User removed from channel" });
    } catch (error) {
      console.error("Error removing user from channel:", error);
      return res
        .status(500)
        .json({ error: "Failed to remove user from channel" });
    }
  },
);
