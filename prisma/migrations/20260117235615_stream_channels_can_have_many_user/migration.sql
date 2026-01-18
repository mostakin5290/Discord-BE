/*
  Warnings:

  - You are about to drop the column `userId` on the `Channel` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Channel" DROP CONSTRAINT "Channel_userId_fkey";

-- DropIndex
DROP INDEX "Channel_userId_idx";

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "streamChannelId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_streamChannelId_fkey" FOREIGN KEY ("streamChannelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
