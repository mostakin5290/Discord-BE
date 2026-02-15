import type { Response } from "express";
import { client } from "../config/db.js";
import type { AuthRequest } from "../middleware/user.middleware.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

export const getUnreadMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!channelId) {
      return res.status(400).json({ message: "Channel ID required" });
    }

    // Find user's last seen message in this channel
    const lastSeenMessage = await client.message.findFirst({
      where: {
        channelId: channelId,
        seenBy: { has: userId },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all messages after last seen (excluding user's own messages)
    const whereClause: any = {
      channelId: channelId,
      userId: { not: userId }, // Exclude own messages
    };

    if (lastSeenMessage) {
      whereClause.createdAt = { gt: lastSeenMessage.createdAt };
    }

    const unreadMessages = await client.message.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      lastSeenAt: lastSeenMessage?.createdAt || null,
      unreadCount: unreadMessages.length,
      messages: unreadMessages,
    });
  } catch (error: any) {
    console.error("Error fetching unread messages:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAISummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!channelId) {
      return res.status(400).json({ message: "Channel ID required" });
    }

    // Find last seen message
    const lastSeenMessage = await client.message.findFirst({
      where: {
        channelId: channelId,
        seenBy: { has: userId },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get unread messages (excluding user's own messages)
    const whereClause2: any = {
      channelId: channelId,
      userId: { not: userId }, // Exclude own messages
    };

    if (lastSeenMessage) {
      whereClause2.createdAt = { gt: lastSeenMessage.createdAt };
    }

    const unreadMessages = await client.message.findMany({
      where: whereClause2,
      include: {
        user: {
          select: { username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100, // Limit to last 100 messages
    });

    if (unreadMessages.length === 0) {
      console.log("\n📭 [CATCH ME UP] No unread messages");
      return res.json({
        summary: "No new messages since you were last here! 🎉",
        messageCount: 0,
        messages: [],
      });
    }

    console.log("\n🤖 [CATCH ME UP] Generating AI Summary");
    console.log(`📊 User: ${userId}`);
    console.log(`📢 Channel: ${channelId}`);
    console.log(`📨 Unread Messages: ${unreadMessages.length}`);
    console.log(`⏰ Time Range: ${unreadMessages[0]?.createdAt} → ${unreadMessages[unreadMessages.length - 1]?.createdAt}`);

    // Format messages for AI
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

    // Generate AI summary
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a helpful assistant summarizing Discord channel messages. 

Here are ${unreadMessages.length} messages you missed:

${messagesText}

Provide a concise, friendly summary in 2-3 sentences covering:
- Main topics discussed
- Important decisions or announcements
- Any questions directed at the user

Keep it casual and conversational.`;

    console.log("⏳ [AI] Generating summary...");
    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    console.log("\n✅ [AI SUMMARY GENERATED]:");
    console.log("─────────────────────────────────");
    console.log(summary);
    console.log("─────────────────────────────────\n");

    // IMPORTANT: Update last seen in DB after generating summary
    if (unreadMessages.length > 0) {
      const lastMessage = unreadMessages[unreadMessages.length - 1];
      if (lastMessage) {
        try {
          const currentSeenBy = lastMessage.seenBy || [];
          if (!currentSeenBy.includes(userId)) {
            await client.message.update({
              where: { id: lastMessage.id },
              data: { seenBy: [...currentSeenBy, userId] },
            });
            console.log(`✅ [DB UPDATE] Last seen updated for user ${userId} to message ${lastMessage.id}`);
          }
        } catch (err) {
          console.error(`❌ [DB UPDATE] Failed to update last seen:`, err);
        }
      }
    }

    res.json({
      summary,
      messageCount: unreadMessages.length,
      timeRange: {
        from: unreadMessages[0]?.createdAt,
        to: unreadMessages[unreadMessages.length - 1]?.createdAt,
      },
      messages: unreadMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        author: msg.user.firstName || msg.user.username,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error generating AI summary:", error);
    res.status(500).json({ message: error.message });
  }
};
