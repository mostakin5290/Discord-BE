import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import type { Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  // Get allowed origins from environment or default to localhost
  const allowedOrigins = process.env.FRONTEND_BASE_URL 
    ? [process.env.FRONTEND_BASE_URL, "http://localhost:5173", "http://localhost:3000"]
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

  io.on("connection", (socket) => {
    console.log("Socket: Client connected:", socket.id, "User:", socket.data.userId);

    // Join a room with their userId so we can emit to them specifically
    if (socket.data.userId) {
      socket.join(socket.data.userId);
      console.log("Socket: User", socket.data.userId, "joined room:", socket.data.userId);
      // Broadcast that this user is online
      socket.broadcast.emit("user_connected", { userId: socket.data.userId });
    }

    socket.on("join_channel", (channelId: string) => {
      socket.join(channelId);
    });

    socket.on("leave_channel", (channelId: string) => {
      socket.leave(channelId);
    });

    socket.on("send_message", (message: any) => {
      if (message.channelId) {
        socket.to(message.channelId).emit("receive_message", message);
      }
    });

    socket.on("typing", (data: { channelId: string; isTyping: boolean }) => {
      socket.to(data.channelId).emit("user_typing", {
        userId: socket.data.userId,
        isTyping: data.isTyping,
        channelId: data.channelId,
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket: Client disconnected:", socket.id, "User:", socket.data.userId);
      if (socket.data.userId) {
        socket.broadcast.emit("user_disconnected", {
          userId: socket.data.userId,
        });
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
