// Quick script to check last seen data in database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLastSeen() {
  try {
    console.log('🔍 Checking Last Seen Data...\n');

    // Get recent messages with seenBy data
    const messages = await prisma.message.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        channelId: true,
        userId: true,
        seenBy: true,
        createdAt: true,
      },
    });

    console.log('📊 Recent Messages:\n');
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. Message ID: ${msg.id}`);
      console.log(`   Content: ${msg.content.substring(0, 50)}...`);
      console.log(`   Channel: ${msg.channelId}`);
      console.log(`   Sender: ${msg.userId}`);
      console.log(`   👁️  Seen By: ${msg.seenBy?.length || 0} users`);
      if (msg.seenBy && msg.seenBy.length > 0) {
        console.log(`   User IDs: ${msg.seenBy.join(', ')}`);
      }
      console.log('');
    });

    // Get specific channel stats
    const channelId = 'cml0rk24v00024ohoj1j47xj9';
    const channelMessages = await prisma.message.findMany({
      where: { channelId },
      select: {
        id: true,
        content: true,
        seenBy: true,
      },
    });

    console.log(`\n📢 Channel ${channelId} Stats:`);
    console.log(`Total Messages: ${channelMessages.length}`);
    
    const messagesWithSeenBy = channelMessages.filter(m => m.seenBy && m.seenBy.length > 0);
    console.log(`Messages with Seen Data: ${messagesWithSeenBy.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLastSeen();
