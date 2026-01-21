import type { Response } from "express";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { DiscoveryService } from "../services/discovery.service.js";

export const discoverServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const query = req.query.search as string;

    const servers = await DiscoveryService.discoverServers(userId, query);

    res.status(200).json({
      success: true,
      servers,
    });
  },
);

export const getServerDetails = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const server = await DiscoveryService.getServerDetails(serverId, userId);

    res.status(200).json({
      success: true,
      server,
    });
  },
);

export const getCategories = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const categories = await DiscoveryService.getCategories();

    res.status(200).json({
      success: true,
      categories,
    });
  },
);

export const getServersByCategory = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { category } = req.params;
    const userId = req.userId!;

    if (!category) {
      throw new AppError("Category is required", 400);
    }

    const servers = await DiscoveryService.getServersByCategory(
      category,
      userId,
    );

    res.status(200).json({
      success: true,
      servers,
    });
  },
);
