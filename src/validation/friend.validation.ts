import { z } from "zod";

export const SendFriendRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

export const BlockUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export type SendFriendRequestInput = z.infer<typeof SendFriendRequestSchema>;
export type BlockUserInput = z.infer<typeof BlockUserSchema>;
