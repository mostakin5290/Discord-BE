-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "reactions" JSONB;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "bannerUrl" TEXT,
ALTER COLUMN "imageUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannerUrl" TEXT;
