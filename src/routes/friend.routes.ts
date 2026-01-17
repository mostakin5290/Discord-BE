import { Router } from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getPendingRequests,
  getFriends,
  removeFriend,
  cancelFriendRequest,
  getSentRequests,
} from "../controllers/friend.controller.js";
import { authenticate } from "../middleware/user.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Friend Request Routes
router.post("/request", sendFriendRequest);
router.get("/requests/pending", getPendingRequests);
router.get("/requests/sent", getSentRequests);
router.patch("/request/:requestId/accept", acceptFriendRequest);
router.patch("/request/:requestId/reject", rejectFriendRequest);
router.delete("/request/:requestId", cancelFriendRequest);

// Friend Routes
router.get("/", getFriends);
router.delete("/:friendId", removeFriend);

export default router;
