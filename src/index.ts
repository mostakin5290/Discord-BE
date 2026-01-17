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

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = env.PORT;
const frontend_url = env.FRONTEND_BASE_URL;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

import passport from "./config/passport.js";
app.use(passport.initialize());

// Main routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/server", serverRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/dm", dmRoutes);
app.use("/api/v1/dm-actions", dmActionsRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "All Good!",
  });
});

app.use(globalErrorHandler);

import { initSocket } from "./socket.js";

// Start Backend
const server = app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  try {
    await client.$connect();
    console.log("Database connected successfully");
    initSocket(server);
    console.log("Socket.IO initialized");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
});
