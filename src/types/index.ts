import { z } from "zod";
import type { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string;
}

export interface UserSelect {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
  bio?: string;
  streamChannelId?: string;
}

export interface ServerWithDetails {
  id: string;
  name: string;
  imageUrl?: string;
  bannerUrl?: string;
  bio?: string;
  inviteCode: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  channels: ChannelType[];
  members: MemberWithUser[];
  _count?: {
    members: number;
  };
}

export interface ChannelType {
  id: string;
  name: string;
  type: "TEXT" | "AUDIO" | "VIDEO";
  serverId: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberWithUser {
  id: string;
  role: "ADMIN" | "MODERATOR" | "GUEST";
  userId: string;
  serverId: string;
  createdAt: Date;
  updatedAt: Date;
  user: UserSelect;
}

export interface MessageType {
  id: string;
  content: string;
  fileUrl?: string;
  fileType?: string;
  deleted: boolean;
  isEdited: boolean;
  userId: string;
  channelId?: string;
  conversationId?: string;
  createdAt: Date;
  updatedAt: Date;
  user: UserSelect;
}

export interface ConversationType {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: Date;
  updatedAt: Date;
  user1: UserSelect;
  user2: UserSelect;
  directMessages?: MessageType[];
}

export interface FriendRequestType {
  id: string;
  senderId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  sender: UserSelect;
  receiver: UserSelect;
}

export const CreateServerSchema = z.object({
  name: z.string("Not a valid string").min(2).max(50),
  imageUrl: z.string().optional(),
  bio: z.string().optional(),
});
