import { Router } from "express";
import {
  getAllConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  deleteConversation,
} from "../controllers/dm.controller.js";
import { authenticate } from "../middleware/user.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getAllConversations);
router.get("/:friendId", getOrCreateConversation);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);
router.patch("/message/:messageId", updateMessage);
router.delete("/message/:messageId", deleteMessage);
router.delete("/:conversationId", deleteConversation);

export default router;
