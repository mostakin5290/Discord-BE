import { Router } from "express";
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  updateRolePositions,
} from "../../controllers/server/role.controller.js";
import { protect } from "../../middleware/user.middleware.js";

const roleRoutes = Router({ mergeParams: true });

roleRoutes.use(protect);

roleRoutes.get("/", getRoles);
roleRoutes.post("/", createRole);
roleRoutes.put("/positions", updateRolePositions); // Batch update positions
roleRoutes.put("/:roleId", updateRole);
roleRoutes.delete("/:roleId", deleteRole);


export default roleRoutes;
