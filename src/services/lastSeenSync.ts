import { client } from "../config/db.js";
import { getLastSeenFromRedis, clearLastSeenFromRedis } from "./redis.js";

export const syncLastSeenToDB = async (userId: string) => {
  const lastSeenData = await getLastSeenFromRedis(userId);
  const entries = Object.entries(lastSeenData);
  
  if (entries.length === 0) return;

  try {
    const updates = entries.map(([channelId, messageId]) =>
      client.message.findUnique({
        where: { id: messageId },
        select: { seenBy: true }
      }).then((msg) => {
        if (!msg || (msg.seenBy || []).includes(userId)) return null;
        return client.message.update({
          where: { id: messageId },
          data: { seenBy: [...(msg.seenBy || []), userId] },
        });
      }).catch(() => null)
    );
    
    await Promise.all(updates);
    await clearLastSeenFromRedis(userId);
    console.log(`✅ [PERIODIC SYNC] Synced ${entries.length} channels for user ${userId}`);
  } catch (error) {
    console.error(`❌ [SYNC ERROR] User ${userId}:`, error);
  }
};
