import { Router } from "express";
import { createToken } from "../controllers/livekit.controller.js";
import { protect } from "../middleware/user.middleware.js";

const livekitRoutes = Router();

livekitRoutes.use(protect);

livekitRoutes.post("/create-token", createToken);

export default livekitRoutes;