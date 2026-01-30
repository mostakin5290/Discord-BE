import { client } from "../config/db.js";
import { startConsumer, ensureTopicExists } from "./kafka.js";
import { checkUserOnline, publishEvent } from "./redis.js";
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

class MessageBatchProcessor {
  private channelMessages: KafkaMessage[] = [];
  private directMessages: KafkaMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL_MS = 5000; // 5 seconds
  private isProcessing = false;

  constructor() {
    this.startBatchProcessor();
  }

  private startBatchProcessor() {
    this.batchInterval = setInterval(() => {
      this.processBatches();
    }, this.BATCH_INTERVAL_MS);
  }

  addMessage(message: KafkaMessage) {
    if (message.type === "CHANNEL_MESSAGE") {
      this.channelMessages.push(message);
    } else if (message.type === "DIRECT_MESSAGE") {
      this.directMessages.push(message);
    }
  }

  private async processBatches() {
    if (this.isProcessing) {
      return; // Skip if already processing
    }

    this.isProcessing = true;

    try {
      // Process channel messages in batch
      if (this.channelMessages.length > 0) {
        const messagesToProcess = [...this.channelMessages];
        this.channelMessages = [];

        await this.writeChannelMessagesBatch(messagesToProcess);
      }

      // Process direct messages in batch
      if (this.directMessages.length > 0) {
        const messagesToProcess = [...this.directMessages];
        this.directMessages = [];

        await this.writeDirectMessagesBatch(messagesToProcess);
      }
    } catch (error) {
      console.error("Batch processing error:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async writeChannelMessagesBatch(messages: KafkaMessage[]) {
    try {
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

      // Use createMany for batch insert
      await client.message.createMany({
        data: messagesToCreate,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error("Error writing channel messages batch:", error);
      // Fallback to individual writes if batch fails
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
        }
      }
    }
  }

  private async writeDirectMessagesBatch(messages: KafkaMessage[]) {
    try {
      const messagesToCreate = messages
        .filter((msg) => msg.payload.conversationId)
        .map((msg) => {
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

      if (messagesToCreate.length === 0) return;

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

      for (const msg of messages) {
        if (msg.payload.conversationId) {
          const convId = msg.payload.conversationId;
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
      for (const msg of messages) {
        if (!msg.payload.conversationId) continue;

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

          await client.conversation.update({
            where: { id: msg.payload.conversationId },
            data: {
              lastMessageAt: createdAt,
              lastMessageId: msg.payload.id || null,
              updatedAt: createdAt,
            },
          });
        } catch (err) {
          console.error("Error writing individual direct message:", err);
        }
      }
    }
  }

  // Force flush remaining messages (useful for graceful shutdown)
  async flush() {
    await this.processBatches();
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

  batchProcessor.addMessage(message);
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