import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";
import type { Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000"],
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
    // console.log("Client connected:", socket.id, "User:", socket.data.userId);

    // Join a room with their userId so we can emit to them specifically
    if (socket.data.userId) {
      socket.join(socket.data.userId);
      // Broadcast that this user is online
      socket.broadcast.emit("user_connected", { userId: socket.data.userId });
    }

    socket.on("join_channel", (channelId: string) => {
      socket.join(channelId);
      // console.log(`User ${socket.data.userId} joined channel ${channelId}`);
    });

    socket.on("leave_channel", (channelId: string) => {
      socket.leave(channelId);
      // console.log(`User ${socket.data.userId} left channel ${channelId}`);
    });

    socket.on("send_message", (message: any) => {
      // Message persistence should happen via API call, then this event broadcasts it
      // OR this event triggers persistence + broadcast.
      // For now, assuming API call persists and returns message, and we just broadcast here.
      // But usually, frontend calls API -> API returns msg -> Frontend emits 'new_message' -> Socket broadcasts.
      // BETTER: API persistence triggers socket broadcast from controller.
      
      // However, for typical chat apps, we can just broadcast to room:
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
      // console.log("Client disconnected:", socket.id);
      if (socket.data.userId) {
        socket.broadcast.emit("user_disconnected", { userId: socket.data.userId });
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
