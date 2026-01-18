import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { AccessToken } from "livekit-server-sdk";

export const createToken = catchAsync(
    async (req: Request, res: Response) => {
        try {
            const { roomName, participantName, participantIdentity } = await req.body;

            if (!roomName || !participantName) {
                return res.status(400).json(
                    { error: "Missing required fields: roomName, participantName" },
                );
            }

            const apiKey = process.env.LIVEKIT_API_KEY;
            const apiSecret = process.env.LIVEKIT_API_SECRET;

            const at = new AccessToken(apiKey, apiSecret, {
                identity: participantIdentity || participantName,
                name: participantName,
                ttl: "1h",
            });

            at.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
            });

            const token = await at.toJwt();

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