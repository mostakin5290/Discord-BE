import { Router } from "express";
import {
  getChannelMessages,
  sendMessage,
  deleteMessage,
  searchMessages,
} from "../controllers/message.controller.js";
import {
  addReaction,
  removeReaction,
} from "../controllers/message-reactions.controller.js";
import { protect } from "../middleware/user.middleware.js";
import multer from "multer";

const messageRoutes = Router();
const upload = multer();

// All routes require authentication
messageRoutes.use(protect);

messageRoutes.get("/channel/:channelId", getChannelMessages);
messageRoutes.get("/search/:serverId", searchMessages);
messageRoutes.post("/channel/:channelId", upload.single("file"), sendMessage);
messageRoutes.delete("/:messageId", deleteMessage);
messageRoutes.post("/:messageId/reactions", addReaction);
messageRoutes.delete("/:messageId/reactions/:emoji", removeReaction);

export default messageRoutes;
