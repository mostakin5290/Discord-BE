import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import type { Server as HttpServer } from "http";
import {
  setUserOnline,
  setUserOffline,
  subscribeToEvent,
  checkUserOnline,
} from "./services/redis.js";
import { produceMessage } from "./services/kafka.js";
import { client } from "./config/db.js";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  // Get allowed origins from environment or default to localhost
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
    // console.log(
    //   "Socket: Client connected:",
    //   socket.id,
    //   "User:",
    //   socket.data.userId,
    // );

    if (socket.data.userId) {
      await setUserOnline(socket.data.userId, "server-1");
      socket.join(socket.data.userId);

      // Broadcast to others that this user is online
      socket.broadcast.emit("user_connected", { userId: socket.data.userId });

      // Send list of online friends to the newly connected user
      try {
        const friends = await client.friend.findMany({
          where: { userId: socket.data.userId },
          select: { friendId: true },
        });

        const onlineFriends = [];
        for (const friend of friends) {
          const isOnline = await checkUserOnline(friend.friendId);
          if (isOnline) {
            onlineFriends.push(friend.friendId);
          }
        }

        // Emit to this specific socket
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

    socket.on("disconnect", async () => {
      console.log(
        "Socket: Client disconnected:",
        socket.id,
        "User:",
        socket.data.userId,
      );
      if (socket.data.userId) {
        await setUserOffline(socket.data.userId);
        socket.broadcast.emit("user_disconnected", {
          userId: socket.data.userId,
        });
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
