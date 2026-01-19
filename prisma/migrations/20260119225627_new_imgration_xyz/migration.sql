/*
  Warnings:

  - You are about to drop the column `participantId` on the `Conversation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userOneId,userTwoId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userOneId` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userTwoId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_participantId_fkey";

-- DropIndex
DROP INDEX "Conversation_participantId_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "participantId",
ADD COLUMN     "userOneId" TEXT NOT NULL,
ADD COLUMN     "userTwoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isDeactivated" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Conversation_userOneId_idx" ON "Conversation"("userOneId");

-- CreateIndex
CREATE INDEX "Conversation_userTwoId_idx" ON "Conversation"("userTwoId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userOneId_userTwoId_key" ON "Conversation"("userOneId", "userTwoId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userOneId_fkey" FOREIGN KEY ("userOneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userTwoId_fkey" FOREIGN KEY ("userTwoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
