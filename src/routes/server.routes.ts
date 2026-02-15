import { Router } from "express";
import {
  createServer,
  getUserServers,
  getServerById,
  joinServer,
  createChannel,
  getServerChannels,
  leaveServer,
  inviteCodeJoin,
  updateServer,
  regenerateInviteCode,
  kickMember,
  banMember,
  deleteServer,
  updateMemberRole,
} from "../controllers/server.controller.js";
import { protect } from "../middleware/user.middleware.js";
import roleRoutes from "./role.routes.js";

const serverRoutes = Router();

// All routes require authentication
serverRoutes.use(protect);

serverRoutes.use("/:serverId/roles", roleRoutes);

serverRoutes.post("/create", createServer);
serverRoutes.get("/list", getUserServers);
serverRoutes.get("/:serverId", getServerById);
serverRoutes.post("/join", joinServer);
serverRoutes.post("/:serverId/channels", createChannel);
serverRoutes.get("/:serverId/channels", getServerChannels);
serverRoutes.post("/leave/:serverId", leaveServer);
serverRoutes.post("/:serverId/invite/:invitecode", inviteCodeJoin);
serverRoutes.put("/update/:serverId", updateServer);
serverRoutes.patch("/:serverId/invite", regenerateInviteCode);

serverRoutes.post("/kick/:serverId/:memberId", kickMember as any);
serverRoutes.post("/ban/:serverId/:memberId", banMember as any);

serverRoutes.delete("/:serverId", deleteServer as any);
serverRoutes.patch("/:serverId/members/:memberId/role", updateMemberRole as any);


export default serverRoutes;
