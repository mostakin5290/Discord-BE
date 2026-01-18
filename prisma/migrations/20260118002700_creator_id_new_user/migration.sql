-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "reactions" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannerUrl" TEXT;
