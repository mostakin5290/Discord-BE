import { randomUUID } from "crypto";
import { produceMessage } from "../services/kafka.js";
import type { NotificationPayload } from "../types/index.js";

export const sendPushNotification = async ({ message, topic, notifyLink, type, userId, createdAt, read, readAt, updatedAt }: NotificationPayload) => {
    const notificationId = randomUUID();
    // Prepare message payload for Kafka
    const messagePayload = {
        id: notificationId,
        message: message,
        topic: topic,
        notifyLink: notifyLink,
        type: type,
        userId: userId,
        readAt: readAt,
        read: read,
        createdAt: createdAt,
        updatedAt: updatedAt,
    };
    // Publish to Kafka (fire-and-forget, connectProducer handled internally)
    produceMessage("notification", notificationId, {
        type: "NOTIFICATION",
        payload: messagePayload,
    }).catch((error) => {
        console.error("Failed to publish notification", error);
    });
};