import { Router } from "express";
import {
  createServer,
  getUserServers,
  getServerById,
  joinServer,
  createChannel,
  getServerChannels,
} from "../controllers/server.controller.js";
import { protect } from "../middleware/user.middleware.js";

const serverRoutes = Router();

// All routes require authentication
serverRoutes.use(protect);

serverRoutes.post("/create", createServer);
serverRoutes.get("/list", getUserServers);
serverRoutes.get("/:serverId", getServerById);
serverRoutes.post("/join", joinServer);
serverRoutes.post("/:serverId/channels", createChannel);
serverRoutes.get("/:serverId/channels", getServerChannels);

export default serverRoutes;
