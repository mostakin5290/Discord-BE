import client from "../config/db.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import type { Response } from "express";

export const getAllNotifications = catchAsync(
    async (req: AuthRequest, res: Response) => {
        const userId = req.userId;

        const notifications = await client.notification.findMany({
            where: { userId: userId!, read: false },
        });

        res.status(200).json({
            success: true,
            notifications,
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

        // TODO: Add notification to Kafka ( Create it there & send it to the user via socket )
        const notification = await client.notification.create({
            data: {
                topic: topic ?? "",
                message: message ?? "",
                notifyLink: notifyLink ?? "",
                type: type ?? "SYSTEM_NOTIFICATION",
                userId: userId!
            }
        });

        res.status(201).json({
            success: true,
            message: "Notification created successfully",
            notification,
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