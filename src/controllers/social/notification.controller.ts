import { randomUUID } from "crypto";
import client from "../../config/db.js";
import type { AuthRequest } from "../../middleware/user.middleware.js";
import { AppError } from "../../utils/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import type { Response } from "express";
import { NotificationType } from "@prisma/client";
import { produceMessage } from "../../services/messaging/kafka.js";

export const getAllNotifications = catchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.userId;

        const notifications = await client.notification.findMany({
            where: { userId: userId!, read: false },

            orderBy: { createdAt: "desc" },
        });

        res.status(200).json({
            success: true,
            message: "Notifications fetched successfully",
            notifications: notifications,
        });
    }
);

export const markAsReadAll = catchAsync(
    async (req: AuthRequest, res: Response) => {
        const notificationIds: string[] = req.body.notificationIds;
        const userId = req.userId;

        if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
            throw new AppError("Notification IDs are required", 400);
        }

        const result = await client.notification.updateMany({
            where: {
                id: { in: notificationIds },
                userId: userId!,
            },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        res.status(200).json({
            success: true,
            message: "Notifications marked as read",
            updatedCount: result.count,
        });
    }
);


export const createNotification = catchAsync(
    async (req: AuthRequest, res: Response) => {
        const { topic, message, notifyLink, type } = req.body;
        const userId = req.userId;

        if (!topic && !message && !notifyLink && !type) {
            throw new AppError("All fields are required", 400);
        };

        const notificationId = randomUUID();

        // Prepare message payload for Kafka
        const messagePayload = {
            id: notificationId,
            message: message,
            topic: topic,
            notifyLink: notifyLink,
            type: type as NotificationType,
            userId: userId,
            readAt: null,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Publish to Kafka (fire-and-forget, connectProducer handled internally)
        produceMessage("notification", notificationId, {
            type: "NOTIFICATION",
            payload: messagePayload,
        }).catch((error) => {
            console.error("Failed to publish notification to Kafka:", error);
        });

        res.status(201).json({
            success: true,
            message: "Notification created successfully",
        });
    }
);

export const markNotificationAsRead = catchAsync(
    async (req: AuthRequest, res: Response) => {
        const { notificationId } = req.params;
        const userId = req.userId;

        if (!notificationId) {
            throw new AppError("Notification ID is required", 400);
        };

        const notification = await client.notification.update({
            where: { id: notificationId!, userId: userId! },
            data: { read: true, readAt: new Date() },
        });

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    }
);