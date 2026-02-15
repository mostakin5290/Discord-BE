import type { Response } from "express";
import { pineconeIndex } from "../config/pinecone.js";
import type { AuthRequest } from "../types/index.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { createEmbedding } from "../utils/embedding.js";
import client from "../config/db.js";

export const searchServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { query } = req.query;
    console.log("🔍 [SEARCH] Query received:", query);
    
    if (!query || typeof query !== "string") {
      throw new AppError("Query is required and must be a string", 400);
    }

    console.log("🤖 [EMBEDDING] Creating embedding for:", query);
    const serverEmbeddings = await createEmbedding(query as string);
    console.log("✅ [EMBEDDING] Created, length:", serverEmbeddings.length);

    // Retry logic for Pinecone eventual consistency
    console.log("📌 [PINECONE] Querying (attempt 1)...");
    let results = await pineconeIndex.query({
      vector: serverEmbeddings,
      topK: 10,
      includeMetadata: true,
    });
    console.log("📊 [PINECONE] Results:", results.matches?.length || 0, "matches");
    
    let retries = 0;
    const maxRetries = 2;
    
    while (retries < maxRetries && (!results.matches || results.matches.length === 0)) {
      retries++;
      console.log(`🔄 [RETRY] Attempt ${retries + 1}/${maxRetries + 1} after 500ms...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      results = await pineconeIndex.query({
        vector: serverEmbeddings,
        topK: 10,
        includeMetadata: true,
      });
      console.log("📊 [PINECONE] Retry results:", results.matches?.length || 0, "matches");
    }

    const serverIds = results.matches?.map((match) => match.id) ?? [];
    console.log("🆔 [SERVER IDS]:", serverIds);

    const scoreMap = new Map(
      results.matches?.map(m => [m.id, m.score || 0]) || []
    );
    console.log("📈 [SCORES]:", Array.from(scoreMap.entries()));

    const servers = await client.server.findMany({
      where: {
        id: {
          in: serverIds,
        },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        bannerUrl: true,
        bio: true,
        members: {
          select: {
            id: true,
          }
        },
      }
    });
    console.log("💾 [DB] Found servers:", servers.length);

    const sortedServers = servers.sort((a: any, b: any) => {
      const scoreA = scoreMap.get(a.id) || 0;
      const scoreB = scoreMap.get(b.id) || 0;
      return scoreB - scoreA;
    });
    console.log("✅ [FINAL] Returning", sortedServers.length, "sorted servers\n");

    res.status(200).json({
      success: true,
      servers: sortedServers,
    });
  }
);

export const getAllServers = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const servers = await client.server.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        bannerUrl: true,
        bio: true,
        members: {
          select: {
            id: true,
          }
        }
      },
    });

    res.status(200).json({
      success: true,
      servers: servers,
    });
  }
);
