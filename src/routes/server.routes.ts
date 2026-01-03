import { Router } from "express";
import { createServer } from "../controllers/server.controller.js";

const serverRoutes = Router();

serverRoutes.post('/create', createServer);

export default serverRoutes;