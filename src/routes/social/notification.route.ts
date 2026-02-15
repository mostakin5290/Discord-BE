import { Router } from "express";
import { protect } from "../../middleware/user.middleware.js";
import { createNotification, getAllNotifications, markAsReadAll, markNotificationAsRead } from "../../controllers/social/notification.controller.js";

const notificationRoutes = Router();

notificationRoutes.use(protect);

notificationRoutes.get("/all", getAllNotifications);
notificationRoutes.post("/mark-as-read/all", markAsReadAll);
notificationRoutes.post("/mark-as-read/:notificationId", markNotificationAsRead);
notificationRoutes.post("/create", createNotification);

export default notificationRoutes;