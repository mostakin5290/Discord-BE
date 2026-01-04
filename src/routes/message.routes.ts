import { Router } from "express";
import {
  getChannelMessages,
  sendMessage,
  deleteMessage,
} from "../controllers/message.controller.js";
import { protect } from "../middleware/user.middleware.js";

const messageRoutes = Router();

// All routes require authentication
messageRoutes.use(protect);

messageRoutes.get("/channel/:channelId", getChannelMessages);
messageRoutes.post("/channel/:channelId", sendMessage);
messageRoutes.delete("/:messageId", deleteMessage);

export default messageRoutes;
