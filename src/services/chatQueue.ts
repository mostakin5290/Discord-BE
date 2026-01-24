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

const handleDBWrite = async (message: KafkaMessage) => {
  try {
    const { type, payload } = message;

    if (type === "CHANNEL_MESSAGE") {
      const data: any = {
        content: payload.content,
        fileUrl: payload.fileUrl,
        channelId: payload.channelId!,
        userId: payload.userId,
        createdAt: payload.createdAt,
      };
      if (payload.id) data.id = payload.id;

      await client.message.create({
        data,
      });
    } else if (type === "DIRECT_MESSAGE") {
      if (payload.conversationId) {
        const data: any = {
          content: payload.content,
          fileUrl: payload.fileUrl,
          senderId: payload.userId,
          receiverId: payload.receiverId!,
          conversationId: payload.conversationId,
          createdAt: payload.createdAt,
        };
        if (payload.id) data.id = payload.id;

        await client.directMessage.create({
          data,
        });

        await client.conversation.update({
          where: { id: payload.conversationId },
          data: {
            lastMessageAt: payload.createdAt,
            lastMessageId: payload.id || null,
            updatedAt: payload.createdAt,
          },
        });
      }
    }
  } catch (error) {
    console.error("DB Writer Error:", error);
  }
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
  await startConsumer(
    "realtime-sender-group",
    "chat-messages",
    handleRealtimeSend,
  );
};
