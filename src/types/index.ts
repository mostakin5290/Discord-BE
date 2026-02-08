import { z } from "zod/v4";
import type { Request } from "express";
import type { NotificationType } from "@prisma/client";

export interface AuthRequest extends Request {
  userId?: string;
}

export const CreateServerSchema = z.object({
  name: z.string("Not a valid string").min(2).max(50),
  imageUrl: z.string().optional(),
  bio: z.string().optional(),
});


export interface NotificationPayload {
  id?: string;
  message: string;
  topic: string;
  notifyLink?: string;
  type: NotificationType;
  userId: string;
  readAt: Date | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}