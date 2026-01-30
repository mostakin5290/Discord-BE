import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import client from "./config/db.js";
import serverRoutes from "./routes/server.routes.js";
import authRoutes from "./routes/auth.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import messageRoutes from "./routes/message.routes.js";
import friendRoutes from "./routes/friend.routes.js";
import dmRoutes from "./routes/dm.routes.js";
import dmActionsRoutes from "./routes/dm-actions.routes.js";
import discoveryRoutes from "./routes/discovery.routes.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = env.PORT;
const frontend_url = env.FRONTEND_BASE_URL;

// Get allowed origins from environment or default to localhost
const allowedOrigins = process.env.FRONTEND_BASE_URL 
  ? [process.env.FRONTEND_BASE_URL, "http://localhost:5173"]
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

import passport from "./config/passport.js";
import livekitRoutes from "./routes/livekit.route.js";
app.use(passport.initialize());

// Main routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/server", serverRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/dm", dmRoutes);
app.use("/api/v1/dm-actions", dmActionsRoutes);
app.use("/api/v1/livekit", livekitRoutes);
app.use("/api/v1/discovery", discoveryRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "All Good!",
  });
});

app.use(globalErrorHandler);

import { initSocket } from "./socket.js";
import { initChatQueueConsumers } from "./services/chatQueue.js";
import { initServerQueueConsumers } from "./services/serverQueue.js";

// Start Backend
const server = app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  try {
    await client.$connect();
    console.log("Database connected successfully");
    initSocket(server);
    console.log("Socket.IO initialized");
    await initChatQueueConsumers();
    await initServerQueueConsumers();
  } catch (error) {
    console.error("Initialization error:", error);
    // Don't exit, allowing the server to stay alive even if Kafka/DB hiccups
    // process.exit(1);
  }
});
