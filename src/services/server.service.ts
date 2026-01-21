import client from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { nanoid } from "nanoid";
import { pineconeIndex } from "../config/pinecone.js";
import { createEmbedding } from "../utils/embedding.js";

export class ServerService {
  static async createServer(data: {
    name: string;
    imageUrl?: string;
    bannerUrl?: string;
    bio?: string;
    userId: string;
  }) {
    const inviteCode = nanoid(10);

    const server = await client.server.create({
      data: {
        name: data.name,
        imageUrl: data.imageUrl ?? "",
        bannerUrl: data.bannerUrl ?? "",
        bio: data.bio ?? "",
        inviteCode,
        userId: data.userId,
        members: {
          create: {
            role: "ADMIN",
            userId: data.userId,
          },
        },
        channels: {
          create: {
            name: "general",
            type: "TEXT",
            creatorId: data.userId,
          },
        },
      },
      include: {
        members: true,
        channels: true,
      },
    });

    if (server.bio) {
      const serverEmbeddings = await createEmbedding(server.bio);
      await pineconeIndex.upsert([
        {
          id: server.id,
          values: serverEmbeddings,
          metadata: {
            serverBio: server.bio,
          },
        },
      ]);
    }

    return server;
  }

  static async getUserServers(userId: string) {
    return client.server.findMany({
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
  }

  static async getServerById(serverId: string, userId: string) {
    const server = await client.server.findUnique({
      where: { id: serverId },
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

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const isMember = server.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new AppError("You are not a member of this server", 403);
    }

    return server;
  }

  static async updateServer(
    serverId: string,
    userId: string,
    data: {
      name?: string;
      imageUrl?: string;
      bannerUrl?: string;
      bio?: string;
    },
  ) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const member = server.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR")) {
      throw new AppError(
        "You don't have permission to update this server",
        403,
      );
    }

    const updatedServer = await client.server.update({
      where: { id: serverId },
      data,
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

    if (data.bio) {
      const serverEmbeddings = await createEmbedding(data.bio);
      await pineconeIndex.upsert([
        {
          id: serverId,
          values: serverEmbeddings,
          metadata: {
            serverBio: data.bio,
          },
        },
      ]);
    }

    return updatedServer;
  }

  static async deleteServer(serverId: string, userId: string) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const member = server.members.find((m) => m.userId === userId);
    if (!member || member.role !== "ADMIN") {
      throw new AppError("Only admins can delete servers", 403);
    }

    await client.server.delete({
      where: { id: serverId },
    });

    return { message: "Server deleted successfully" };
  }

  static async joinServer(inviteCode: string, userId: string) {
    const server = await client.server.findUnique({
      where: { inviteCode },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Invalid invite code", 404);
    }

    const existingMember = server.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new AppError("You are already a member of this server", 400);
    }

    await client.member.create({
      data: {
        userId,
        serverId: server.id,
        role: "GUEST",
      },
    });

    const updatedServer = await client.server.findUnique({
      where: { id: server.id },
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

    return updatedServer;
  }

  static async leaveServer(serverId: string, userId: string) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const member = server.members.find((m) => m.userId === userId);
    if (!member) {
      throw new AppError("You are not a member of this server", 400);
    }

    if (member.role === "ADMIN") {
      throw new AppError(
        "Admins cannot leave the server. Transfer ownership or delete the server instead.",
        400,
      );
    }

    await client.member.delete({
      where: {
        id: member.id,
      },
    });

    return { message: "Left server successfully" };
  }

  static async createChannel(
    serverId: string,
    userId: string,
    data: {
      name: string;
      type: "TEXT" | "AUDIO" | "VIDEO";
    },
  ) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const member = server.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR")) {
      throw new AppError("You don't have permission to create channels", 403);
    }

    const channel = await client.channel.create({
      data: {
        name: data.name,
        type: data.type,
        serverId,
        creatorId: userId,
      },
    });

    return channel;
  }

  static async deleteChannel(channelId: string, userId: string) {
    const channel = await client.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    const member = channel.server.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR")) {
      throw new AppError("You don't have permission to delete channels", 403);
    }

    await client.channel.delete({
      where: { id: channelId },
    });

    return { message: "Channel deleted successfully" };
  }

  static async updateChannel(
    channelId: string,
    userId: string,
    data: {
      name?: string;
      type?: "TEXT" | "AUDIO" | "VIDEO";
    },
  ) {
    const channel = await client.channel.findUnique({
      where: { id: channelId },
      include: {
        server: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    const member = channel.server.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR")) {
      throw new AppError("You don't have permission to update channels", 403);
    }

    const updatedChannel = await client.channel.update({
      where: { id: channelId },
      data,
    });

    return updatedChannel;
  }

  static async regenerateInviteCode(serverId: string, userId: string) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: true,
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const member = server.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "ADMIN" && member.role !== "MODERATOR")) {
      throw new AppError(
        "You don't have permission to regenerate invite code",
        403,
      );
    }

    const inviteCode = nanoid(10);

    const updatedServer = await client.server.update({
      where: { id: serverId },
      data: { inviteCode },
    });

    return { inviteCode: updatedServer.inviteCode };
  }

  static async getServerChannels(serverId: string, userId: string) {
    // Verify user is a member
    const member = await client.member.findFirst({
      where: {
        serverId,
        userId,
      },
    });

    if (!member) {
      throw new AppError("You are not a member of this server", 403);
    }

    const channels = await client.channel.findMany({
      where: { serverId },
      orderBy: { createdAt: "asc" },
    });

    return channels;
  }
}
