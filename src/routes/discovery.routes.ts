import { Router } from "express";
import {
  discoverServers,
  getServerDetails,
  getCategories,
  getServersByCategory,
} from "../controllers/discovery.controller.js";
import { protect } from "../middleware/user.middleware.js";

const discoveryRoutes = Router();

discoveryRoutes.use(protect);

discoveryRoutes.get("/", discoverServers);
discoveryRoutes.get("/categories", getCategories);
discoveryRoutes.get("/category/:category", getServersByCategory);
discoveryRoutes.get("/:serverId", getServerDetails);

export default discoveryRoutes;
