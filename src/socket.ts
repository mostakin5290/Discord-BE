import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import type { Server as HttpServer } from "http";
import redis, {
  setUserOnline,
  setUserOffline,
  subscribeToEvent,
  checkUserOnline,
  updateLastSeenInRedis,
  getLastSeenFromRedis,
  clearLastSeenFromRedis,
} from "./services/cache/redis.js";
import { produceMessage } from "./services/messaging/kafka.js";
import { client } from "./config/db.js";
import { syncLastSeenToDB } from "./services/cache/lastSeenSync.js";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  const allowedOrigins = process.env.FRONTEND_BASE_URL
    ? [
      process.env.FRONTEND_BASE_URL,
      "http://localhost:5173",
      "http://localhost:3000",
    ]
    : ["http://localhost:5173", "http://localhost:3000"];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token?.split(" ")[1] ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;

    if (userId) {
      await setUserOnline(userId, "server-1");
      socket.join(userId);

      const syncInterval = setInterval(() => {
        syncLastSeenToDB(userId).catch(console.error);
      }, 5 * 60 * 1000);

      socket.on("disconnect", () => clearInterval(syncInterval));

      socket.broadcast.emit("user_connected", { userId });

      try {
        const friends = await client.friend.findMany({
          where: { userId },
          select: { friendId: true },
        });

        const onlineFriends = [];
        for (const friend of friends) {
          const isOnline = await checkUserOnline(friend.friendId);
          if (isOnline) {
            onlineFriends.push(friend.friendId);
          }
        }

        socket.emit("online_friends", { userIds: onlineFriends });
      } catch (error) {
        console.error("Error fetching online friends:", error);
      }
    }

    socket.on("join_channel", (channelId: string) => {
      socket.join(channelId);
    });

    socket.on("leave_channel", (channelId: string) => {
      socket.leave(channelId);
    });

    socket.on("send_message", async (message: any) => {
      const payload = {
        ...message,
        userId: socket.data.userId,
        createdAt: new Date(),
        id: message.id || undefined,
      };

      const type = message.channelId ? "CHANNEL_MESSAGE" : "DIRECT_MESSAGE";
      const topic = "chat-messages";

      const key =
        message.channelId || message.conversationId || socket.data.userId;

      await produceMessage(topic, key, {
        type,
        payload,
      });
    });

    socket.on("typing", (data: { channelId: string; isTyping: boolean }) => {
      socket.to(data.channelId).emit("user_typing", {
        userId: socket.data.userId,
        isTyping: data.isTyping,
        channelId: data.channelId,
      });
    });

    socket.on("update_last_seen", async (data: { channelId: string; messageId: string }) => {
      const userId = socket.data.userId;
      if (userId) {
        await updateLastSeenInRedis(userId, data.channelId, data.messageId);
      }
    });

    socket.on("disconnect", async () => {
      const userId = socket.data.userId;
      
      if (userId) {
        const lastSeenData = await getLastSeenFromRedis(userId);
        const entries = Object.entries(lastSeenData);
        
        if (entries.length > 0) {
          
          try {
            const updates = entries.map(([channelId, messageId]) => 
              client.message.findUnique({
                where: { id: messageId },
                select: { seenBy: true }
              }).then((msg) => {
                if (!msg || (msg.seenBy || []).includes(userId)) return null;
                return client.message.update({
                  where: { id: messageId },
                  data: { seenBy: [...(msg.seenBy || []), userId] },
                });
              }).catch(() => null)
            );
            
            await Promise.all(updates);
          } catch (error) {
            console.error(`❌ [ERROR] Failed to save last seen:`, error);
          }
          
          await clearLastSeenFromRedis(userId);
        } else {
        }
        
        await setUserOffline(userId);
        socket.broadcast.emit("user_disconnected", { userId });
      }
    });
  });

  subscribeToEvent("socket.updates", (message: any) => {
    const { type, data } = message;
    if (type === "CHANNEL_MESSAGE") {
      io.to(data.channelId).emit("receive_message", data);
    } else if (type === "DIRECT_MESSAGE") {
      io.to(data.receiverId).emit("direct_message_received", data);
      if (data.userId) {
        io.to(data.userId).emit("direct_message_sent", data);
      }
    } else if (type === "NOTIFICATION") {
      if (data.userId) {
        io.to(data.userId).emit("notification_received", data);
      }
    }
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
