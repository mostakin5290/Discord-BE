import express from "express";
import { protect } from "../../middleware/user.middleware.js";
import {
  pinMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  replyToMessage
} from "../../controllers/messaging/dm-actions.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Message actions
router.patch("/messages/:messageId/pin", pinMessage);
router.delete("/messages/:messageId", deleteMessage);
router.post("/messages/:messageId/reactions", addReaction);
router.delete("/messages/:messageId/reactions/:emoji", removeReaction);
router.post("/messages/:messageId/reply", replyToMessage);

export default router;
