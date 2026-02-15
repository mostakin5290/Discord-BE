import type { Response } from "express";
import client from "../../config/db.js";
import type { AuthRequest } from "../../middleware/user.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { AppError } from "../../utils/AppError.js";

// Add Reaction to Server Message
export const addReaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId!;

    if (!emoji) {
      throw new AppError("Emoji is required", 400);
    }

    if (!messageId) {
      throw new AppError("Message ID is required", 400);
    }

    const message = await client.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            server: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Verify user has access to this channel
    if (message.channel.server.members.length === 0) {
      throw new AppError("You don't have access to this channel", 403);
    }

    // Get existing reactions
    const reactions = (message.reactions as any) || {};

    // Remove user from all other emojis (only one reaction per user)
    Object.keys(reactions).forEach((existingEmoji) => {
      if (existingEmoji !== emoji && Array.isArray(reactions[existingEmoji])) {
        reactions[existingEmoji] = reactions[existingEmoji].filter(
          (id: string) => id !== userId,
        );
        if (reactions[existingEmoji].length === 0) {
          delete reactions[existingEmoji];
        }
      }
    });

    // Initialize emoji array if it doesn't exist
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    // Add user to emoji array if not already there
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }

    const updatedMessage = await client.message.update({
      where: { id: messageId },
      data: { reactions },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Reaction added",
      data: updatedMessage,
    });
  },
);

// Remove Reaction from Server Message
export const removeReaction = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { messageId, emoji } = req.params;
    const userId = req.userId!;

    if (!messageId || !emoji) {
      throw new AppError("Message ID and emoji are required", 400);
    }

    const message = await client.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          include: {
            server: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Verify user has access
    if (message.channel.server.members.length === 0) {
      throw new AppError("You don't have access to this channel", 403);
    }

    // Get existing reactions
    const reactions = (message.reactions as any) || {};

    // Remove user from emoji array
    if (reactions[emoji] && Array.isArray(reactions[emoji])) {
      reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);

      // Remove emoji key if no users left
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    const updatedMessage = await client.message.update({
      where: { id: messageId },
      data: { reactions },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Reaction removed",
      data: updatedMessage,
    });
  },
);
