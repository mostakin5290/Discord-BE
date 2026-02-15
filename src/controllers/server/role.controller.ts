import type { Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";
import client from "../../config/db.js";
import type { AuthRequest } from "../../middleware/user.middleware.js";

// Get all roles for a server
export const getRoles = catchAsync(async (req: AuthRequest, res: Response) => {
  const { serverId } = req.params;

  if (!serverId) {
    throw new AppError("Server ID is required", 400);
  }

  const roles = await client.role.findMany({
    where: { serverId },
    orderBy: { position: "asc" },
    include: {
        _count: {
            select: { members: true }
        }
    }
  });

  res.status(200).json({
    success: true,
    roles,
  });
});

// Create a new role
export const createRole = catchAsync(async (req: AuthRequest, res: Response) => {
  const { serverId } = req.params;
  const { name, color, permissions } = req.body;
  const userId = req.userId!;

  if (!serverId) {
      throw new AppError("Server ID is required", 400);
  }

  // Check permissions (User must be admin or have MANAGE_ROLES)
  // For now, simple ADMIN check on member
  const member = await client.member.findFirst({
    where: { serverId, userId, role: "ADMIN" },
  });

  if (!member) {
    throw new AppError("You do not have permission to manage roles", 403);
  }

  const role = await client.role.create({
    data: {
      name: name || "New Role",
      color: color || "#99AAB5",
      permissions: permissions || "",
      serverId,
      position: 0, // Should calculate last position
    },
  });

  res.status(201).json({
    success: true,
    role,
  });
});

// Update a role
export const updateRole = catchAsync(async (req: AuthRequest, res: Response) => {
    const { serverId, roleId } = req.params;
    const { name, color, permissions, position } = req.body;
    const userId = req.userId!;

    if (!serverId || !roleId) {
        throw new AppError("Server ID and Role ID are required", 400);
    }
  
    const member = await client.member.findFirst({
      where: { serverId, userId, role: "ADMIN" },
    });
  
    if (!member) {
      throw new AppError("You do not have permission to manage roles", 403);
    }

    const updateData: any = {
        name,
        color,
        position
    };

    if (permissions !== undefined) {
        updateData.permissions = JSON.stringify(permissions);
    }
  
    const role = await client.role.update({
      where: { id: roleId },
      data: updateData,
    });
  
    res.status(200).json({
      success: true,
      role,
    });
  });

// Delete a role
export const deleteRole = catchAsync(async (req: AuthRequest, res: Response) => {
    const { serverId, roleId } = req.params;
    const userId = req.userId!;

    if (!serverId || !roleId) {
        throw new AppError("Server ID and Role ID are required", 400);
    }
  
    const member = await client.member.findFirst({
      where: { serverId, userId, role: "ADMIN" },
    });
  
    if (!member) {
      throw new AppError("You do not have permission to manage roles", 403);
    }
  
    await client.role.delete({
      where: { id: roleId },
    });
  
    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  });

// Update Role Positions (Batch)
export const updateRolePositions = catchAsync(async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { roles } = req.body; // Array of { id, position }
    const userId = req.userId!;

    if (!serverId) {
        throw new AppError("Server ID is required", 400);
    }

    const member = await client.member.findFirst({
        where: { serverId, userId, role: "ADMIN" },
    });
    
    if (!member) {
        throw new AppError("You do not have permission to manage roles", 403);
    }

    // Transaction to update all positions
    const updates = roles.map((role: { id: string, position: number }) => 
        client.role.update({
            where: { id: role.id },
            data: { position: role.position }
        })
    );

    await client.$transaction(updates);

    res.status(200).json({
        success: true,
        message: "Role positions updated",
    });
});
