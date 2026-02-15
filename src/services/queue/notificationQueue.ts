import { ensureTopicExists, startConsumer } from "../messaging/kafka.js";
import redis, {
    checkUserOnline,
    publishEvent,
} from "../cache/redis.js";
import { getIO } from "../../socket.js";
import { NotificationType } from "@prisma/client";
import { client } from "../../config/db.js";
import type { NotificationPayload } from "../../types/index.js";

const NOTIFICATION_QUEUE = "notification";
const NOTIFICATION_PROCESSING = "notification:processing";
const NOTIFICATION_TTL = 86400; // 1 day in seconds

interface KafkaMessage {
    type: "NOTIFICATION";
    payload: NotificationPayload;
}

export const addMessageToBatch = async (
    type: "NOTIFICATION",
    message: any,
) => {
    const queueKey = NOTIFICATION_QUEUE;

    const messageJson = JSON.stringify(message);

    await redis.lpush(queueKey, messageJson);
    await redis.expire(queueKey, NOTIFICATION_TTL);
};

export const getBatchMessagesSafe = async (
    type: "NOTIFICATION",
    count: number = 100,
): Promise<{ messages: any[]; rawMessages: string[] }> => {
    const queueKey = NOTIFICATION_QUEUE;
    const processingKey = NOTIFICATION_PROCESSING;

    const rawMessages: string[] = [];
    for (let i = 0; i < count; i++) {
        const message = await redis.rpoplpush(queueKey, processingKey);
        if (!message) break;
        rawMessages.push(message);
        await redis.expire(processingKey, NOTIFICATION_TTL);
    }

    const messages = rawMessages.map((msg) => JSON.parse(msg));
    return { messages, rawMessages };
};

export const removeFromProcessingQueue = async (
    type: "NOTIFICATION",
    rawMessages: string[],
) => {
    const processingKey = NOTIFICATION_PROCESSING

    for (const msg of rawMessages) {
        await redis.lrem(processingKey, 1, msg);
    }
};

export const requeueMessages = async (
    type: "NOTIFICATION",
    rawMessages: string[],
) => {
    const queueKey = NOTIFICATION_QUEUE;
    const processingKey = NOTIFICATION_PROCESSING;

    for (const msg of rawMessages.reverse()) {
        await redis.lrem(processingKey, 1, msg);
        await redis.lpush(queueKey, msg);
        await redis.expire(queueKey, NOTIFICATION_TTL);
    }
};

export const recoverProcessingQueue = async (
    type: "NOTIFICATION",
) => {
    const queueKey = NOTIFICATION_QUEUE;
    const processingKey = NOTIFICATION_PROCESSING;

    let moved = 0;
    while (true) {
        const message = await redis.rpoplpush(processingKey, queueKey);
        if (!message) break;
        await redis.expire(queueKey, NOTIFICATION_TTL);
        moved++;
    }

    if (moved > 0) {
    }
};

export const getBatchSize = async (
    type: "NOTIFICATION",
): Promise<number> => {
    const queueKey = NOTIFICATION_QUEUE

    return await redis.llen(queueKey);
};

class MessageBatchProcessor {
    private batchInterval: NodeJS.Timeout | null = null;
    private readonly BATCH_INTERVAL_MS = 5000; // 5 seconds
    private isProcessing = false;
    private readonly BATCH_SIZE = 100;

    constructor() {
        this.startBatchProcessor();
        this.recoverStuckMessages();
    };

    private async recoverStuckMessages() {
        try {
            await recoverProcessingQueue("NOTIFICATION")
        } catch (error) {
            console.error("Error recovering stuck messages:", error);
        }
    }

    private startBatchProcessor() {
        this.batchInterval = setInterval(() => {
            this.processBatches();
        }, this.BATCH_INTERVAL_MS);
    }

    async addMessage(message: KafkaMessage) {
        await addMessageToBatch(message.type, message);
    }

    private async processBatches() {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            const NotificationCount = await getBatchSize("NOTIFICATION");

            if (NotificationCount > 0) {
                await this.processUserNotification();
            }

        } catch (error) {
            console.error("Batch processing error:", error);
        } finally {
            this.isProcessing = false;
        }
    }

    private async processUserNotification() {
        const { messages, rawMessages } = await getBatchMessagesSafe("NOTIFICATION", this.BATCH_SIZE);

        if (messages.length === 0) return;

        try {
            await this.writeUserNotificationBatch(messages);
            await removeFromProcessingQueue("NOTIFICATION", rawMessages);
        } catch (error) {
            console.error("Error processing channel messages batch:", error);
            await requeueMessages("NOTIFICATION", rawMessages);
        }
    }


    private async writeUserNotificationBatch(messages: KafkaMessage[]): Promise<void> {
        const notificationsToCreate = messages.map((msg) => {
            const data: any = {
                type: msg.payload.type,
                topic: msg.payload.topic,
                notifyLink: msg.payload.notifyLink,
                message: msg.payload.message!,
                userId: msg.payload.userId,
                readAt: msg.payload.readAt,
                read: msg.payload.read,
                createdAt: msg.payload.createdAt,
                updatedAt: msg.payload.updatedAt,
            };
            if (msg.payload.id) data.id = msg.payload.id;
            return data;
        });

        try {
            await client.notification.createMany({
                data: notificationsToCreate,
                skipDuplicates: true,
            });
        } catch (error) {
            console.error("Error writing notification batch:", error);
            const failedMessages: KafkaMessage[] = [];

            for (const msg of messages) {
                try {
                    const data: any = {
                        type: msg.payload.type,
                        topic: msg.payload.topic,
                        notifyLink: msg.payload.notifyLink,
                        message: msg.payload.message!,
                        userId: msg.payload.userId,
                        readAt: msg.payload.readAt,
                        read: msg.payload.read,
                        createdAt: msg.payload.createdAt,
                        updatedAt: msg.payload.updatedAt,
                    };
                    if (msg.payload.id) data.id = msg.payload.id;

                    await client.notification.create({ data });
                } catch (err) {
                    console.error("Error writing individual notification:", err);
                    failedMessages.push(msg);
                }
            }

            if (failedMessages.length > 0) {
                throw new Error(`Failed to write ${failedMessages.length} notification`);
            }
        }
    }

    async flush() {
        let hasMore = true;
        while (hasMore) {
            const notificationCount = await getBatchSize("NOTIFICATION");

            if (notificationCount > 0) {
                await this.processUserNotification();
            }

            const notificationMsg = await getBatchSize("NOTIFICATION");
            hasMore = notificationMsg > 0;
        }
    }

    stop() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }
    }
}

const batchProcessor = new MessageBatchProcessor();

const handleDBWrite = async (message: KafkaMessage) => {
    await batchProcessor.addMessage(message);
};

const handleRealtimeSend = async (message: KafkaMessage) => {
    const { type, payload } = message;
    const io = getIO();
    if (!io) return;

    if (message.type === "NOTIFICATION") {
        const receiverOnline = await checkUserOnline(payload.userId);
        if (receiverOnline) {
            io.to(payload.userId).emit("notification_received", payload);
        }

        publishEvent("socket.updates", {
            type: "NOTIFICATION",
            data: payload,
        });
    }
};

export const initNotificationQueueConsumers = async () => {
    await ensureTopicExists("notification");

    await startConsumer("notification-writer-group", "notification", handleDBWrite);
    await startConsumer("notification-sender-group", "notification", handleRealtimeSend);
};

export const flushMessageBatches = async () => {
    await batchProcessor.flush();
    batchProcessor.stop();
};