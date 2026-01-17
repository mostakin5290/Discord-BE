import { z } from "zod/v4";
import type { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string;
}

export const CreateServerSchema = z.object({
  name: z.string("Not a valid string").min(2).max(50),
  imageUrl: z.string().optional(),
  bio: z.string().optional(),
});
