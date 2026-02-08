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

    if (searchMember.role === "ADMIN") {
      // Check if there are other members
      const memberCount = await client.member.count({
        where: {
          serverId: serverId ?? "",
        }
      });

      if (memberCount > 1) {
        res.status(400).json({
          success: false,
          error: "Admins cannot leave server. You must transfer ownership or delete the server."
        })
        return;
      }

      // If only member (the admin), delete the server
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

    const updateServer = await client.server.update({
      where: { id: serverId, userId },
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