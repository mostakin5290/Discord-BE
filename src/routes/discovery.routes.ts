import { Router } from "express";
import { getAllServers, searchServers } from "../controllers/discovery.controller.js";
import { protect } from "../middleware/user.middleware.js";

const discoveryRoutes = Router();

// All routes require authentication
discoveryRoutes.use(protect);

discoveryRoutes.get("/all/featured", getAllServers);
discoveryRoutes.get("/search", searchServers);

export default discoveryRoutes;