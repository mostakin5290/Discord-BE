import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import axios from "axios";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import client from "./config/db.js";
import serverRoutes from "./routes/server/server.routes.js";
import authRoutes from "./routes/auth/auth.routes.js";
import uploadRoutes from "./routes/media/upload.routes.js";
import messageRoutes from "./routes/messaging/message.routes.js";
import friendRoutes from "./routes/social/friend.routes.js";
import dmRoutes from "./routes/messaging/dm.routes.js";
import dmActionsRoutes from "./routes/messaging/dm-actions.routes.js";
import discoveryRoutes from "./routes/ai/discovery.routes.js";
import notificationRoutes from "./routes/social/notification.route.js";
import summaryRoutes from "./routes/ai/summary.routes.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = env.PORT;
const frontend_url = env.FRONTEND_BASE_URL;

const allowedOrigins = process.env.FRONTEND_BASE_URL 
  ? [process.env.FRONTEND_BASE_URL, "http://localhost:5173"]
  : ["http://localhost:5173"];

  const keepAlive = async () => {
    try {
        await axios.get('https://keepalive404.netlify.app/.netlify/functions/keepalive');

        await axios.get('https://discord-be-yne6.onrender.com/keep-alive');

    } catch (err) {
        console.error('Keep-alive failed:', err);
    }
};

setInterval(keepAlive, 14 * 60 * 1000);


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
import livekitRoutes from "./routes/media/livekit.route.js";
app.use(passport.initialize());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/server", serverRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/dm", dmRoutes);
app.use("/api/v1/dm-actions", dmActionsRoutes);
app.use("/api/v1/livekit", livekitRoutes);
app.use("/api/v1/discovery", discoveryRoutes);
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1/summary", summaryRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "All Good!",
  });
});

app.use(globalErrorHandler);

import { initSocket } from "./socket.js";
import { initChatQueueConsumers } from "./services/queue/chatQueue.js";
import { initServerQueueConsumers } from "./services/queue/serverQueue.js";
import { initNotificationQueueConsumers } from "./services/queue/notificationQueue.js";

const server = app.listen(port, async () => {
  try {
    await client.$connect();
    console.log("Database connected successfully");
    initSocket(server);
    await initChatQueueConsumers();
    await initServerQueueConsumers();
    await initNotificationQueueConsumers();

    console.log(`Server is running on port ${port}`);

  } catch (error) {
    console.error("Initialization error:", error);
  }
});
