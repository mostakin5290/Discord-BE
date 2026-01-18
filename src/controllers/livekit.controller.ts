import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { AccessToken } from "livekit-server-sdk";
import type { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import client from "../config/db.js";
import { getIO } from "../socket.js";

export const createToken = async ({ roomName, participantName, participantIdentity }: { roomName: string, participantName: string, participantIdentity: string }) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

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
            const { roomName, participantName, participantIdentity, friendId } = await req.body;
            const userId = req.userId;

            if (!roomName || !participantName) {
                return res.status(400).json(
                    { error: "Missing required fields: roomName, participantName" },
                );
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

            const { token } = await createToken({ roomName, participantName, participantIdentity });

            // Generate a separate token for the friend to join the same room
            const { token: friendToken } = await createToken({
                roomName,
                participantName: friend.username,
                participantIdentity: friendId,
            });

            getIO().to(friendId).emit("incoming_call", {
                token: friendToken,
                roomName,
                fromFriendId: userId,
                fromFriendName: participantName,
            });

            return res.status(200).json({ token, roomName });
        }
        catch (error) {
            console.error("Error generating token:", error);
            return res.status(500).json(
                { error: "Failed to generate token" },
            );
        }
    }
)

export const createGroupCallToken = catchAsync(
    async (req: AuthRequest, res: Response) => {
        try {
            const { roomName, participantName, participantIdentity, channelId, serverId } = await req.body;
            const userId = req.userId;

            if (!roomName || !participantName) {
                return res.status(400).json(
                    { error: "Missing required fields: roomName, participantName" },
                );
            }

            if (!userId) {
                throw new AppError("User not authenticated", 401);
            }

            const { token } = await createToken({ roomName, participantName, participantIdentity });

            const addUserToChannel = await client.user.update({
                where: { id: userId },
                data: {
                    streamChannelId: channelId,
                }
            });

            // getIO().to(userId).emit("user_joined_room", { token, roomName, fromFriendId: userId, fromFriendName: participantName });

            return res.status(200).json({ token });
        }
        catch (error) {
            console.error("Error generating token:", error);
            return res.status(500).json(
                { error: "Failed to generate token" },
            );
        }
    }
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
                }
            });
            if (!removeUserFromChannel) {
                throw new AppError("Failed to remove user from channel", 400);
            }

            return res.status(200).json({ message: "User removed from channel" });
        }
        catch (error) {
            console.error("Error removing user from channel:", error);
            return res.status(500).json(
                { error: "Failed to remove user from channel" },
            );
        }
    }
)