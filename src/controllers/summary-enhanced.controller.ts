import type { Response } from "express";
import { client } from "../config/db.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { AIService } from "../services/ai.service.js";

// Helper to get unread messages
async function getUnreadMessagesForChannel(userId: string, channelId: string) {
  const lastSeenMessage = await client.message.findFirst({
    where: {
      channelId: channelId,
      seenBy: { has: userId },
    },
    orderBy: { createdAt: "desc" },
  });

  const whereClause: any = { channelId: channelId };
  if (lastSeenMessage) {
    whereClause.createdAt = { gt: lastSeenMessage.createdAt };
  }

  return await client.message.findMany({
    where: whereClause,
    include: {
      user: {
        select: { username: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

// Basic Summary (Current)
export const getAISummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId || !channelId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const unreadMessages = await getUnreadMessagesForChannel(userId, channelId);

    if (unreadMessages.length === 0) {
      return res.json({
        summary: "No new messages since you were last here! 🎉",
        messageCount: 0,
      });
    }

    console.log("\n🤖 [CATCH ME UP] Generating AI Summary");
    console.log(`📊 User: ${userId}`);
    console.log(`📢 Channel: ${channelId}`);
    console.log(`📨 Unread Messages: ${unreadMessages.length}`);

    const messagesText = unreadMessages
      .map((msg) => {
        const author = msg.user.firstName || msg.user.username;
        return `${author}: ${msg.content}`;
      })
      .join("\n");

    console.log("\n📝 [MESSAGES SENT TO AI]:");
    console.log("─────────────────────────────────");
    console.log(messagesText);
    console.log("─────────────────────────────────\n");

    const summary = await AIService.generateSummary(messagesText, unreadMessages.length);

    console.log("\n✅ [AI SUMMARY GENERATED]:");
    console.log("─────────────────────────────────");
    console.log(summary);
    console.log("─────────────────────────────────\n");

    res.json({
      summary,
      messageCount: unreadMessages.length,
      timeRange: {
        from: unreadMessages[0]?.createdAt,
        to: unreadMessages[unreadMessages.length - 1]?.createdAt,
      },
    });
  } catch (error: any) {
    console.error("❌ Error generating AI summary:", error);
    res.status(500).json({ message: error.message });
  }
};

// Detailed Summary with Categories
export const getDetailedSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId || !channelId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const unreadMessages = await getUnreadMessagesForChannel(userId, channelId);

    if (unreadMessages.length === 0) {
      return res.json({ messageCount: 0 });
    }

    const messagesText = unreadMessages
      .map((msg) => `${msg.user.firstName || msg.user.username}: ${msg.content}`)
      .join("\n");

    const detailedSummary = await AIService.generateDetailedSummary(
      messagesText,
      unreadMessages.length
    );

    res.json({
      ...detailedSummary,
      messageCount: unreadMessages.length,
    });
  } catch (error: any) {
    console.error("❌ Error generating detailed summary:", error);
    res.status(500).json({ message: error.message });
  }
};

// Bullet Points Summary
export const getBulletSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId || !channelId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const unreadMessages = await getUnreadMessagesForChannel(userId, channelId);

    if (unreadMessages.length === 0) {
      return res.json({ bullets: [], messageCount: 0 });
    }

    const messagesText = unreadMessages
      .map((msg) => `${msg.user.firstName || msg.user.username}: ${msg.content}`)
      .join("\n");

    const bulletPoints = await AIService.generateBulletPoints(
      messagesText,
      unreadMessages.length
    );

    res.json({
      bullets: bulletPoints,
      messageCount: unreadMessages.length,
    });
  } catch (error: any) {
    console.error("❌ Error generating bullet summary:", error);
    res.status(500).json({ message: error.message });
  }
};

// Action Items
export const getActionItems = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId || !channelId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const unreadMessages = await getUnreadMessagesForChannel(userId, channelId);

    if (unreadMessages.length === 0) {
      return res.json({ actionItems: [], messageCount: 0 });
    }

    const messagesText = unreadMessages
      .map((msg) => `${msg.user.firstName || msg.user.username}: ${msg.content}`)
      .join("\n");

    const actionItems = await AIService.extractActionItems(messagesText);

    res.json({
      actionItems,
      messageCount: unreadMessages.length,
    });
  } catch (error: any) {
    console.error("❌ Error extracting action items:", error);
    res.status(500).json({ message: error.message });
  }
};
