import type { Request, Response } from "express";
import client from "../config/db.js";
import { CreateServerSchema } from "../types/index.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/AppError.js";
import { nanoid } from "nanoid";
import { pineconeIndex } from "../config/pinecone.js";
import { createEmbedding } from "../utils/embedding.js";
import { produceMessage } from "../services/kafka.js";
import { NotificationType } from "@prisma/client";
import { sendPushNotification } from "../utils/push-notifications.js";

export const createServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { success, data } = CreateServerSchema.safeParse(req.body);

    if (!success) {
      throw new AppError("Invalid data", 400);
    }

    const userId = req.userId!;
    const inviteCode = nanoid(10);

    // Create server in database
    const server = await client.server.create({
      data: {
        name: data?.name ?? "",
        imageUrl: data?.imageUrl ?? "",
        bio: data?.bio ?? "",
        inviteCode,
        userId,
        members: {
          create: {
            role: "ADMIN",
            userId,
          },
        },
        channels: {
          create: {
            name: "general",
            type: "TEXT",
            creatorId: userId,
          },
        },
      },
      include: {
        members: true,
        channels: true,
      },
    });


    if (server.bio || server.name) {
      const searchableContent = `${server.name}. ${server.bio || ''}`;

      produceMessage("server-index", server.id, {
        serverId: server.id,
        content: {
          name: server.name,
          bio: server.bio || '',
          searchContent: searchableContent,
        },
      }).catch((error) => {
        console.error("Failed to publish server index message:", error);
      });
    }

    // Send push notification to all members of the server
    sendPushNotification({
      message: `Welcome to #${server.name} Server! 🎉`,
      topic: "New Server",
      notifyLink: `/server/${server.id}/${server.channels[0]?.id}`,
      type: NotificationType.SERVER_NOTIFICATION,
      userId: server.userId,
      read: false,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Server created successfully",
      server,
    });
  }
);

export const getUserServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const servers = await client.server.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        channels: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
                streamChannelId: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      servers,
    });
  }
);

export const getServerById = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const server = await client.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        channels: {
          orderBy: {
            createdAt: "asc",
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
                streamChannelId: true,
              },
            },
            roles: true,
          },
        },
      },
    });

    if (!server) {
      throw new AppError("Server not found or you are not a member", 404);
    }

    res.status(200).json({
      success: true,
      server,
    });
  }
);

export const joinServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { inviteCode } = req.body;
    const userId = req.userId!;

    if (!inviteCode) {
      throw new AppError("Invite code is required", 400);
    }

    const server = await client.server.findUnique({
      where: { inviteCode },
    });

    if (!server) {
      throw new AppError("Invalid invite code", 404);
    }

    // Check if user is banned
    const bannedUser = await client.bannedUser.findFirst({
      where: {
        userId,
        serverId: server.id,
      },
    });

    if (bannedUser) {
      throw new AppError("You are banned from this server", 403);
    }

    // Check if already a member
    const existingMember = await client.member.findFirst({
      where: {
        userId,
        serverId: server.id,
      },
    });

    if (existingMember) {
      res.status(201).json({
        success: true,
        message: "You are already a member of this server"
      });

      return;
    };

    // Add user as member
    await client.member.create({
      data: {
        userId,
        serverId: server.id,
        role: "GUEST",
      },
    });

    res.status(200).json({
      success: true,
      message: "Successfully joined the server",
      serverId: server.id,
    });
  }
);

export const createChannel = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { name, type } = req.body;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    if (!name) {
      throw new AppError("Channel name is required", 400);
    }

    // Check if user is admin or moderator
    const member = await client.member.findFirst({
      where: {
        userId,
        serverId,
        role: {
          in: ["ADMIN", "MODERATOR"],
        },
      },
    });

    if (!member) {
      throw new AppError("You don't have permission to create channels", 403);
    }

    const channel = await client.channel.create({
      data: {
        name,
        type: type || "TEXT",
        creatorId: userId,
        serverId: serverId,
      },
    });

    // Send push notification to all members of the server
    sendPushNotification({
      message: `Welcome to #${channel.name} Channel! 🎉`,
      topic: "New Channel",
      notifyLink: `/server/${serverId}/${channel?.id}`,
      type: NotificationType.CHANNEL_NOTIFICATION,
      userId: userId,
      readAt: null,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
    });
  }
);

export const getServerChannels = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    // Verify user is a member
    const member = await client.member.findFirst({
      where: {
        userId,
        serverId,
      },
    });

    if (!member) {
      throw new AppError("You are not a member of this server", 403);
    }

    const channels = await client.channel.findMany({
      where: { serverId: serverId },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      channels,
    });
  }
);

export const leaveServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const searchMember = await client.member.findFirst({
      where: {
        userId: userId ?? "",
        serverId: serverId ?? "",
      },
      select: {
        id: true,
        role: true,
      }
    });

    if (!searchMember || !searchMember?.id) {
      res.status(404).json({
        success: false,
        error: "Member not found"
      })
      return;
    };

    const server = await client.server.findUnique({
      where: { id: serverId },
      select: { userId: true }
    });

    if (server?.userId === userId) {
      // Check if there are other members
      const memberCount = await client.member.count({
        where: {
          serverId: serverId ?? "",
        }
      });

      if (memberCount > 1) {
        res.status(400).json({
          success: false,
          error: "Owner cannot leave server. You must transfer ownership or delete the server."
        })
        return;
      }

      // If only member (the owner), delete the server
      await client.server.delete({
        where: {
          id: serverId ?? "",
        }
      });

      res.status(200).json({
        success: true,
        message: "Server deleted successfully"
      })
      return;
    }

    // Remove from the Members of the server
    const removeMember = await client.member.delete({
      where: {
        id: searchMember?.id ?? "",
        serverId: serverId ?? "",
      },
    });

    if (!removeMember) {
      res.status(403).json({
        success: false,
        error: "Failed to remove member"
      })
      return;
    };

    res.status(200).json({
      success: true,
      message: "Member left successfully"
    })
  }
);

export const inviteCodeJoin = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const { invitecode, serverId } = req.params;

    if (!serverId || !invitecode) {
      throw new AppError("Server ID & InviteCode is required", 400);
    }

    const isValidInViteCode = await client.server.findFirst({
      where: {
        id: serverId ?? "",
        inviteCode: invitecode ?? "",
      }
    });

    if (!isValidInViteCode) {
      res.status(404).json({
        success: false,
        error: "InviteCode not Valid"
      })
    };

    // If user is member already
    const alreadyMember = await client.member.findFirst({
      where: {
        serverId: serverId ?? "",
        userId: userId ?? ""
      }
    });

    if (alreadyMember?.id) {
      res.status(400).json({
        success: true,
        message: "User is Already a Member in this server"
      })
    };

    // Add the user to serve as Member.
    const addAsMember = await client.member.create({
      data: {
        role: "GUEST",
        serverId: serverId ?? "",
        userId: userId ?? ""
      }
    });

    res.status(404).json({
      success: false,
      message: "Member added to server"
    })
  }
)

export const updateServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const { name, bannerUrl, imageUrl, bio } = req.body;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const getServer = await client.server.findUnique({
      where: { id: serverId, userId },
    });

    if (!getServer) {
      throw new AppError("Server not found", 404);
    }

    const bioDataChanged = getServer?.bio !== bio;
    const nameChanged = getServer?.name !== name;

    const member = await client.member.findFirst({
      where: {
        userId,
        serverId,
        role: {
          in: ["ADMIN", "MODERATOR"] // Review: Should Moderator update settings? Plan said Admins. Let's stick to ADMIN for settings.
        }
      }
    });

    const isOwner = getServer.userId === userId;
    const isAdmin = member?.role === "ADMIN";

    if (!isOwner && !isAdmin) {
       throw new AppError("You do not have permission to update server settings", 403);
    }
    
    // ... logic for updates ...
    
    const updateServer = await client.server.update({
      where: { id: serverId }, // Removed userId check since we verified permissions separately
      data: { name, bannerUrl, imageUrl, bio },
    });

    if (bioDataChanged || nameChanged) {
      const searchableContent = `${name}. ${bio || ''}`;
      const serverEmbeddings = await createEmbedding(searchableContent);
      await pineconeIndex.upsert([
        {
          id: serverId,
          values: serverEmbeddings,
          metadata: {
            serverName: name as string,
            serverBio: bio as string || '',
          }
        },
      ]);
    }

    res.status(200).json({
      success: true,
      message: "Server updated successfully",
      server: updateServer,
    });
  }
);

export const regenerateInviteCode = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    // Verify user is admin
    const member = await client.member.findFirst({
      where: {
        userId,
        serverId,
        role: "ADMIN",
      },
    });

    if (!member) {
      throw new AppError("You don't have permission to regenerate invite code", 403);
    }

    const newInviteCode = nanoid(10);

    const updatedServer = await client.server.update({
      where: { id: serverId },
      data: {
        inviteCode: newInviteCode,
      },
      select: {
        inviteCode: true,
        id: true,
      }
    });

    res.status(200).json({
      success: true,
      message: "Invite code regenerated successfully",
      inviteCode: updatedServer.inviteCode,
      serverId: updatedServer.id,
    });
  }
);

export const kickMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId, memberId } = req.params;
    const userId = req.userId!;

    if (!serverId || !memberId) {
      throw new AppError("Server ID and Member ID are required", 400);
    }

    // Verify current user permissions (must be ADMIN or MODERATOR)
    const currentUserMember = await client.member.findFirst({
      where: {
        userId,
        serverId,
      },
    });

    if (!currentUserMember || (currentUserMember.role !== "ADMIN" && currentUserMember.role !== "MODERATOR")) {
      throw new AppError("You don't have permission to kick members", 403);
    }

    // Prevent kicking self
    if (currentUserMember.id === memberId) {
      throw new AppError("You cannot kick yourself", 400);
    }

    // Find the member to kick
    const memberToKick = await client.member.findUnique({
      where: {
        id: memberId,
      },
      include: {
        user: true,
      }
    });

    if (!memberToKick) {
      throw new AppError("Member not found", 404);
    }

    // Prevent kicking Admins (unless you are owner - simplified here to just admin check)
    // In a real app, you'd check role hierarchy. For now, let's say Admin cannot be kicked by anyone except maybe owner?
    // Let's assume ADMIN role is highest and cannot be kicked by MODERATOR.
    if (memberToKick.role === "ADMIN") {
       throw new AppError("Cannot kick an Admin", 403);
    }
    
    // Make sure Moderator cannot kick another Moderator? 
    if (currentUserMember.role === "MODERATOR" && memberToKick.role === "MODERATOR") {
      throw new AppError("Moderators cannot kick other Moderators", 403);
    }


    await client.member.delete({
      where: {
        id: memberId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Member kicked successfully",
      memberId: memberId,
    });
  }
);

export const banMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId, memberId } = req.params;
    const userId = req.userId!;

    if (!serverId || !memberId) {
      throw new AppError("Server ID and Member ID are required", 400);
    }

    // Verify permissions
    const currentUserMember = await client.member.findFirst({
      where: {
        userId,
        serverId,
      },
    });

    if (!currentUserMember || (currentUserMember.role !== "ADMIN" && currentUserMember.role !== "MODERATOR")) {
      throw new AppError("You don't have permission to ban members", 403);
    }

    // Prevent banning self
    if (currentUserMember.id === memberId) {
      throw new AppError("You cannot ban yourself", 400);
    }

    // Find member
    const memberToBan = await client.member.findUnique({
      where: { id: memberId },
    });

    if (!memberToBan) {
      throw new AppError("Member not found", 404);
    }

    // Hierarchy checks
    if (memberToBan.role === "ADMIN") {
      throw new AppError("Cannot ban an Admin", 403);
    }
     if (currentUserMember.role === "MODERATOR" && memberToBan.role === "MODERATOR") {
      throw new AppError("Moderators cannot ban other Moderators", 403);
    }

    // Transaction: Delete member AND create BannedUser entry
    await client.$transaction([
      client.member.delete({
        where: { id: memberId },
      }),
      client.bannedUser.upsert({
        where: {
          userId_serverId: {
            userId: memberToBan.userId,
            serverId: serverId,
          },
        },
        create: {
          userId: memberToBan.userId,
          serverId: serverId,
          reason: req.body.reason || "Banned by moderator",
        },
        update: {
          reason: req.body.reason || "Banned by moderator",
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Member banned successfully",
      memberId: memberId,
    });
  }
);

export const deleteServer = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    const server = await client.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    if (server.userId !== userId) {
      throw new AppError("Only the server owner can delete the server", 403);
    }

    await client.server.delete({
      where: { id: serverId },
    });

    res.status(200).json({
      success: true,
      message: "Server deleted successfully",
    });
  }
);

export const updateMemberRole = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId, memberId } = req.params;
    const { role } = req.body; // GUEST, MODERATOR, ADMIN
    const userId = req.userId!;

    if (!serverId || !memberId || !role) {
      throw new AppError("Server ID, Member ID and Role are required", 400);
    }

    // Check if role is valid
    if (!["GUEST", "MODERATOR", "ADMIN"].includes(role)) {
         throw new AppError("Invalid role", 400);
    }

    // Verify current user permissions (Must be ADMIN or OWNER)
    // Note: We need to fetch the server to check ownership efficiently or we can fetch member
    const currentUserMember = await client.member.findFirst({
        where: { userId, serverId },
        include: { server: true }
    });

    if (!currentUserMember) {
        throw new AppError("You are not a member of this server", 403);
    }

    const isOwner = currentUserMember.server.userId === userId;
    const isAdmin = currentUserMember.role === "ADMIN";

    if (!isOwner && !isAdmin) {
        throw new AppError("You do not have permission to manage roles", 403);
    }

    // Target member
    const targetMember = await client.member.findUnique({
        where: { id: memberId },
    });

    if (!targetMember) {
        throw new AppError("Member not found", 404);
    }

    // Validations:
    // 1. Cannot change owner's role
    // 2. Admin cannot change another Admin's role (unless Owner?) - Let's say Admin can manage anyone except Owner for simplicity, or strictly hierarchical.
    // Let's implement: Owner can do anything. Admin can manage Mod/Guest. Admin cannot manage other Admins?
    
    // Check if target is owner
    if (targetMember.userId === currentUserMember.server.userId) {
        throw new AppError("Cannot change role of the server owner", 403);
    }

    // If current user is just Admin (not Owner), they cannot touch other Admins
    if (!isOwner && targetMember.role === "ADMIN") {
         throw new AppError("Admins cannot modify other Admins", 403);
    }

    // If role (enum) is provided, update the main role
    if (role && ["GUEST", "MODERATOR", "ADMIN"].includes(role)) {
        await client.member.update({
            where: { id: memberId },
            data: { role },
        });
    }

    // If roleIds (custom roles) are provided, update the relation
    const { roleIds } = req.body;
    if (roleIds && Array.isArray(roleIds)) {
        // Validation: Verify all roles belong to this server
        const validRoles = await client.role.findMany({
            where: {
                id: { in: roleIds },
                serverId,
            },
            select: { id: true },
        });
        
        const validRoleIds = validRoles.map(r => r.id);

        await client.member.update({
            where: { id: memberId },
            data: {
                roles: {
                    set: validRoleIds.map(id => ({ id })),
                }
            }
        });
    }

    res.status(200).json({
        success: true,
        message: "Member roles updated successfully",
        memberId,
        role,
        roleIds,
    });
  }
);

export const getBannedUsers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId } = req.params;
    const userId = req.userId!;

    if (!serverId) {
      throw new AppError("Server ID is required", 400);
    }

    // specific permission check? Admin/Mod
    const member = await client.member.findFirst({
        where: { userId, serverId, role: { in: ["ADMIN", "MODERATOR"] } }
    });

    if (!member) {
        throw new AppError("You do not have permission to view banned users", 403);
    }

    const bannedUsers = await client.bannedUser.findMany({
        where: { serverId },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    imageUrl: true,
                }
            }
        }
    });

    console.log(`Fetched ${bannedUsers.length} banned users for server ${serverId}`);


    res.status(200).json({
        success: true,
        bannedUsers
    });
  }
);

export const unbanMember = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { serverId, userId: bannedUserId } = req.params;
    const userId = req.userId!;

    if (!serverId || !bannedUserId) {
        throw new AppError("Server ID and User ID are required", 400);
    }

    const member = await client.member.findFirst({
        where: { userId, serverId, role: { in: ["ADMIN", "MODERATOR"] } }
    });

    if (!member) {
        throw new AppError("You do not have permission to unban users", 403);
    }

    await client.bannedUser.deleteMany({
        where: {
            serverId,
            userId: bannedUserId
        }
    });

    res.status(200).json({
        success: true,
        message: "User unbanned successfully"
    });
  }
);