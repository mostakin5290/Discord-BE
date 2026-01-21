import { z } from "zod";

export const CreateServerSchema = z.object({
  name: z.string().min(1, "Server name is required").max(100),
  imageUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

export const UpdateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  imageUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

export const JoinServerSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

export const CreateChannelSchema = z.object({
  name: z.string().min(1, "Channel name is required").max(100),
  type: z.enum(["TEXT", "AUDIO", "VIDEO"]).default("TEXT"),
});

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["TEXT", "AUDIO", "VIDEO"]).optional(),
});

export type CreateServerInput = z.infer<typeof CreateServerSchema>;
export type UpdateServerInput = z.infer<typeof UpdateServerSchema>;
export type JoinServerInput = z.infer<typeof JoinServerSchema>;
export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>;
