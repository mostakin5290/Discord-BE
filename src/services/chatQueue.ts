import { client } from "../config/db.js";
import { startConsumer, ensureTopicExists } from "./kafka.js";
import redis, {
  checkUserOnline,
  publishEvent,
} from "./redis.js";
import { getIO } from "../socket.js";

interface MessagePayload {
  id?: string;
  content: string;
  fileUrl?: string;
  userId: string;
  channelId?: string;
  receiverId?: string;
  conversationId?: string;
  createdAt: Date;
}

interface KafkaMessage {
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE";
  payload: MessagePayload;
}

const CHANNEL_MESSAGES_QUEUE = "batch:channel-messages";
const DIRECT_MESSAGES_QUEUE = "batch:direct-messages";
const CHANNEL_MESSAGES_PROCESSING = "batch:channel-messages:processing";
const DIRECT_MESSAGES_PROCESSING = "batch:direct-messages:processing";
const MESSAGE_TTL = 86400; // 24 hours in seconds

export const addMessageToBatch = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
  message: any,
) => {
  const queueKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_QUEUE
    : DIRECT_MESSAGES_QUEUE;

  const messageJson = JSON.stringify(message);

  // Add to list and set TTL (24 hours)
  await redis.lpush(queueKey, messageJson);
  await redis.expire(queueKey, MESSAGE_TTL);
};

export const getBatchMessagesSafe = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
  count: number = 100,
): Promise<{ messages: any[]; rawMessages: string[] }> => {
  const queueKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_QUEUE
    : DIRECT_MESSAGES_QUEUE;
  const processingKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_PROCESSING
    : DIRECT_MESSAGES_PROCESSING;

  const rawMessages: string[] = [];
  for (let i = 0; i < count; i++) {
    const message = await redis.rpoplpush(queueKey, processingKey);
    if (!message) break;
    rawMessages.push(message);
    // Set TTL on processing queue as well
    await redis.expire(processingKey, MESSAGE_TTL);
  }

  const messages = rawMessages.map((msg) => JSON.parse(msg));
  return { messages, rawMessages };
};

export const removeFromProcessingQueue = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
  rawMessages: string[],
) => {
  const processingKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_PROCESSING
    : DIRECT_MESSAGES_PROCESSING;

  // Remove each message from processing queue
  for (const msg of rawMessages) {
    await redis.lrem(processingKey, 1, msg);
  }
};

export const requeueMessages = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
  rawMessages: string[],
) => {
  const queueKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_QUEUE
    : DIRECT_MESSAGES_QUEUE;
  const processingKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_PROCESSING
    : DIRECT_MESSAGES_PROCESSING;

  for (const msg of rawMessages.reverse()) {
    await redis.lrem(processingKey, 1, msg);
    await redis.lpush(queueKey, msg);
    await redis.expire(queueKey, MESSAGE_TTL);
  }
};

export const recoverProcessingQueue = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
) => {
  const queueKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_QUEUE
    : DIRECT_MESSAGES_QUEUE;
  const processingKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_PROCESSING
    : DIRECT_MESSAGES_PROCESSING;

  // Move all messages from processing queue back to main queue
  let moved = 0;
  while (true) {
    const message = await redis.rpoplpush(processingKey, queueKey);
    if (!message) break;
    await redis.expire(queueKey, MESSAGE_TTL);
    moved++;
  }

  if (moved > 0) {
    console.log(`Recovered ${moved} ${type} messages from processing queue`);
  }
};

export const getBatchSize = async (
  type: "CHANNEL_MESSAGE" | "DIRECT_MESSAGE",
): Promise<number> => {
  const queueKey = type === "CHANNEL_MESSAGE"
    ? CHANNEL_MESSAGES_QUEUE
    : DIRECT_MESSAGES_QUEUE;

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
  }

  private async recoverStuckMessages() {
    // Recover messages that might be stuck in processing queue (e.g., after crash)
    try {
      await recoverProcessingQueue("CHANNEL_MESSAGE");
      await recoverProcessingQueue("DIRECT_MESSAGE");
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
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      // Check if there are messages to process
      const channelCount = await getBatchSize("CHANNEL_MESSAGE");
      const directCount = await getBatchSize("DIRECT_MESSAGE");

      if (channelCount > 0) {
        await this.processChannelMessages();
      }

      if (directCount > 0) {
        await this.processDirectMessages();
      }
    } catch (error) {
      console.error("Batch processing error:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processChannelMessages() {
    // Safely get messages - moved to processing queue, not deleted
    const { messages, rawMessages } = await getBatchMessagesSafe("CHANNEL_MESSAGE", this.BATCH_SIZE);

    if (messages.length === 0) return;

    try {
      // Try to write to DB
      await this.writeChannelMessagesBatch(messages);
      // If successful, remove from processing queue
      await removeFromProcessingQueue("CHANNEL_MESSAGE", rawMessages);
    } catch (error) {
      console.error("Error processing channel messages batch:", error);
      // If failed, move messages back to main queue for retry
      await requeueMessages("CHANNEL_MESSAGE", rawMessages);
    }
  }

  private async processDirectMessages() {
    // Safely get messages - moved to processing queue, not deleted
    const { messages, rawMessages } = await getBatchMessagesSafe("DIRECT_MESSAGE", this.BATCH_SIZE);

    if (messages.length === 0) return;

    try {
      // Try to write to DB
      await this.writeDirectMessagesBatch(messages);
      // If successful, remove from processing queue
      await removeFromProcessingQueue("DIRECT_MESSAGE", rawMessages);
    } catch (error) {
      console.error("Error processing direct messages batch:", error);
      // If failed, move messages back to main queue for retry
      await requeueMessages("DIRECT_MESSAGE", rawMessages);
    }
  }

  private async writeChannelMessagesBatch(messages: KafkaMessage[]): Promise<void> {
    const messagesToCreate = messages.map((msg) => {
      const data: any = {
        content: msg.payload.content,
        fileUrl: msg.payload.fileUrl,
        channelId: msg.payload.channelId!,
        userId: msg.payload.userId,
        createdAt: msg.payload.createdAt instanceof Date
          ? msg.payload.createdAt
          : new Date(msg.payload.createdAt),
      };
      if (msg.payload.id) data.id = msg.payload.id;
      return data;
    });

    try {
      // Use createMany for batch insert
      await client.message.createMany({
        data: messagesToCreate,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error("Error writing channel messages batch:", error);
      // Fallback to individual writes if batch fails
      const failedMessages: KafkaMessage[] = [];

      for (const msg of messages) {
        try {
          const data: any = {
            content: msg.payload.content,
            fileUrl: msg.payload.fileUrl,
            channelId: msg.payload.channelId!,
            userId: msg.payload.userId,
            createdAt: msg.payload.createdAt instanceof Date
              ? msg.payload.createdAt
              : new Date(msg.payload.createdAt),
          };
          if (msg.payload.id) data.id = msg.payload.id;

          await client.message.create({ data });
        } catch (err) {
          console.error("Error writing individual channel message:", err);
          // Track failed messages to throw error
          failedMessages.push(msg);
        }
      }

      // If any messages failed, throw error to trigger retry
      if (failedMessages.length > 0) {
        throw new Error(`Failed to write ${failedMessages.length} channel messages`);
      }
    }
  }

  private async writeDirectMessagesBatch(messages: KafkaMessage[]): Promise<void> {
    const validMessages = messages.filter((msg) => msg.payload.conversationId);

    if (validMessages.length === 0) return;

    const messagesToCreate = validMessages.map((msg) => {
      const data: any = {
        content: msg.payload.content,
        fileUrl: msg.payload.fileUrl,
        senderId: msg.payload.userId,
        receiverId: msg.payload.receiverId!,
        conversationId: msg.payload.conversationId,
        createdAt: msg.payload.createdAt instanceof Date
          ? msg.payload.createdAt
          : new Date(msg.payload.createdAt),
      };
      if (msg.payload.id) data.id = msg.payload.id;
      return data;
    });

    try {
      // Use createMany for batch insert
      await client.directMessage.createMany({
        data: messagesToCreate,
        skipDuplicates: true,
      });

      // Update conversations in batch
      const conversationUpdates = new Map<string, {
        lastMessageAt: Date;
        lastMessageId: string | null;
        updatedAt: Date;
      }>();

      for (const msg of validMessages) {
        const convId = msg.payload.conversationId!;
        const msgTime = msg.payload.createdAt instanceof Date
          ? msg.payload.createdAt
          : new Date(msg.payload.createdAt);
        const existing = conversationUpdates.get(convId);

        if (!existing || msgTime > existing.lastMessageAt) {
          conversationUpdates.set(convId, {
            lastMessageAt: msgTime,
            lastMessageId: msg.payload.id || null,
            updatedAt: msgTime,
          });
        }
      }

      // Update conversations
      for (const [convId, updateData] of conversationUpdates.entries()) {
        try {
          await client.conversation.update({
            where: { id: convId },
            data: updateData,
          });
        } catch (err) {
          console.error(`Error updating conversation ${convId}:`, err);
        }
      }
    } catch (error) {
      console.error("Error writing direct messages batch:", error);
      // Fallback to individual writes if batch fails
      const failedMessages: KafkaMessage[] = [];

      for (const msg of validMessages) {
        try {
          const createdAt = msg.payload.createdAt instanceof Date
            ? msg.payload.createdAt
            : new Date(msg.payload.createdAt);

          const data: any = {
            content: msg.payload.content,
            fileUrl: msg.payload.fileUrl,
            senderId: msg.payload.userId,
            receiverId: msg.payload.receiverId!,
            conversationId: msg.payload.conversationId,
            createdAt,
          };
          if (msg.payload.id) data.id = msg.payload.id;

          await client.directMessage.create({ data });

          const conversationId = msg.payload.conversationId!;
          await client.conversation.update({
            where: { id: conversationId },
            data: {
              lastMessageAt: createdAt,
              lastMessageId: msg.payload.id || null,
              updatedAt: createdAt,
            },
          });
        } catch (err) {
          console.error("Error writing individual direct message:", err);
          // Track failed messages to throw error
          failedMessages.push(msg);
        }
      }

      // If any messages failed, throw error to trigger retry
      if (failedMessages.length > 0) {
        throw new Error(`Failed to write ${failedMessages.length} direct messages`);
      }
    }
  }

  async flush() {
    // Process all remaining messages
    let hasMore = true;
    while (hasMore) {
      const channelCount = await getBatchSize("CHANNEL_MESSAGE");
      const directCount = await getBatchSize("DIRECT_MESSAGE");

      if (channelCount > 0) {
        await this.processChannelMessages();
      }

      if (directCount > 0) {
        await this.processDirectMessages();
      }

      // Check if there are still messages
      const remainingChannel = await getBatchSize("CHANNEL_MESSAGE");
      const remainingDirect = await getBatchSize("DIRECT_MESSAGE");
      hasMore = remainingChannel > 0 || remainingDirect > 0;
    }
  }

  stop() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
}

// Create singleton instance
const batchProcessor = new MessageBatchProcessor();

const handleDBWrite = async (message: KafkaMessage) => {
  await batchProcessor.addMessage(message);
};

const handleRealtimeSend = async (message: KafkaMessage) => {
  const { type, payload } = message;
  const io = getIO();
  if (!io) return;

  if (type === "CHANNEL_MESSAGE") {
    io.to(payload.channelId!).emit("receive_message", {
      ...payload,
    });

    publishEvent("socket.updates", {
      type: "CHANNEL_MESSAGE",
      data: payload,
    });
  } else if (type === "DIRECT_MESSAGE") {
    const receiverOnline = await checkUserOnline(payload.receiverId!);
    if (receiverOnline) {
      io.to(payload.receiverId!).emit("direct_message_received", payload);
    }

    io.to(payload.userId).emit("direct_message_sent", payload);

    publishEvent("socket.updates", {
      type: "DIRECT_MESSAGE",
      data: payload,
    });
  }
};

export const initChatQueueConsumers = async () => {
  // Ensure topic exists before starting consumers
  await ensureTopicExists("chat-messages");

  // console.log("Starting Chat Queue Consumers...");
  await startConsumer("db-writer-group", "chat-messages", handleDBWrite);
  await startConsumer("realtime-sender-group", "chat-messages", handleRealtimeSend);
};

// Export batch processor for graceful shutdown
export const flushMessageBatches = async () => {
  await batchProcessor.flush();
  batchProcessor.stop();
};