import client from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { pineconeIndex } from "../config/pinecone.js";
import { createEmbedding } from "../utils/embedding.js";

export class DiscoveryService {
  static async discoverServers(userId: string, query?: string) {
    if (query) {
      const queryEmbedding = await createEmbedding(query);

      const searchResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 20,
        includeMetadata: true,
      });

      if (searchResults.matches && searchResults.matches.length > 0) {
        const serverIds = searchResults.matches
          .map((match) => match.id)
          .filter(Boolean);

        const servers = await client.server.findMany({
          where: {
            id: {
              in: serverIds,
            },
          },
          include: {
            _count: {
              select: {
                members: true,
              },
            },
          },
        });

        const serversWithMembership = await Promise.all(
          servers.map(async (server) => {
            const isMember = await client.member.findFirst({
              where: {
                serverId: server.id,
                userId,
              },
            });

            return {
              ...server,
              isMember: !!isMember,
              memberCount: server._count.members,
            };
          }),
        );

        return serversWithMembership;
      }

      return [];
    }

    const servers = await client.server.findMany({
      take: 20,
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const serversWithMembership = await Promise.all(
      servers.map(async (server) => {
        const isMember = await client.member.findFirst({
          where: {
            serverId: server.id,
            userId,
          },
        });

        return {
          ...server,
          isMember: !!isMember,
          memberCount: server._count.members,
        };
      }),
    );

    return serversWithMembership;
  }

  static async getServerDetails(serverId: string, userId: string) {
    const server = await client.server.findUnique({
      where: { id: serverId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                imageUrl: true,
              },
            },
          },
        },
        channels: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!server) {
      throw new AppError("Server not found", 404);
    }

    const isMember = server.members.some((member) => member.userId === userId);

    return {
      ...server,
      isMember,
      memberCount: server._count.members,
    };
  }

  static async getCategories() {
    return [
      {
        id: "gaming",
        name: "Gaming",
        description: "Game communities and guilds",
      },
      {
        id: "music",
        name: "Music",
        description: "Music production and listening",
      },
      {
        id: "education",
        name: "Education",
        description: "Study groups and learning",
      },
      {
        id: "technology",
        name: "Technology",
        description: "Tech discussions and development",
      },
      {
        id: "entertainment",
        name: "Entertainment",
        description: "Movies, shows, and media",
      },
      {
        id: "creative",
        name: "Creative Arts",
        description: "Art, writing, and creativity",
      },
      {
        id: "science",
        name: "Science",
        description: "Scientific discussions and research",
      },
      {
        id: "fitness",
        name: "Fitness",
        description: "Health and fitness communities",
      },
      {
        id: "general",
        name: "General",
        description: "General hangout servers",
      },
    ];
  }

  static async getServersByCategory(category: string, userId: string) {
    const servers = await client.server.findMany({
      where: {
        bio: {
          contains: category,
          mode: "insensitive",
        },
      },
      take: 20,
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    const serversWithMembership = await Promise.all(
      servers.map(async (server) => {
        const isMember = await client.member.findFirst({
          where: {
            serverId: server.id,
            userId,
          },
        });

        return {
          ...server,
          isMember: !!isMember,
          memberCount: server._count.members,
        };
      }),
    );

    return serversWithMembership;
  }
}
