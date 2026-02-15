import { Router } from "express";
import { authenticate } from "../../middleware/user.middleware.js";
import { getUnreadMessages, getAISummary } from "../../controllers/ai/summary.controller.js";

const router = Router();

router.get("/channels/:channelId/unread", authenticate, getUnreadMessages);
router.get("/channels/:channelId/summary", authenticate, getAISummary);

export default router;
