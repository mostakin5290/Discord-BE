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
      if (!query || typeof query !== "string") {
        throw new AppError("Query is required and must be a string", 400);
      }
  
      const serverEmbeddings = await createEmbedding(query as string);
  
      const results = await pineconeIndex.query({
        vector: serverEmbeddings,
        topK: 10,
        includeMetadata: true,
      });
  
      const serverIds = results.matches?.map((match) => match.id) ?? [];
  
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
  
      res.status(200).json({
        success: true,
        servers,
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
  