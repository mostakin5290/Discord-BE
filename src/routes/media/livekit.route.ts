import { Router } from "express";
import { createDirectCallToken, createGroupCallToken, createToken, removeUserFromChannel } from "../../controllers/media/livekit.controller.js";
import { protect } from "../../middleware/user.middleware.js";

const livekitRoutes = Router();

livekitRoutes.use(protect);

// livekitRoutes.post("/create-token", createToken);
livekitRoutes.post("/create-group-call-token", createGroupCallToken);
livekitRoutes.post("/create-direct-call-token", createDirectCallToken);
livekitRoutes.post("/remove-user-from-channel", removeUserFromChannel);

export default livekitRoutes;