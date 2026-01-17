import { Router } from "express";
import {
  getConversations,
  getConversationMessages,
  sendDirectMessage,
  deleteDirectMessage,
  markMessagesAsRead,
  getUnreadCount,
} from "../controllers/dm.controller.js";
import { authenticate } from "../middleware/user.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Conversation Routes
router.get("/conversations", getConversations);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.patch("/conversations/:conversationId/read", markMessagesAsRead);

// Direct Message Routes
router.post("/:friendId", sendDirectMessage);
router.delete("/messages/:messageId", deleteDirectMessage);
router.get("/unread-count", getUnreadCount);

export default router;
