
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log("Connecting to database...");
    const bans = await prisma.bannedUser.findMany({
        include: {
            user: true
        }
    });
    console.log("All Banned Users:", JSON.stringify(bans, null, 2));

    const servers = await prisma.server.findMany({ select: { id: true, name: true } });
    console.log("All Servers:", JSON.stringify(servers, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
