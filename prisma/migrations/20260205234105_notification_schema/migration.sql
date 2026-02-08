-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM_NOTIFICATION', 'FRIEND_REQUEST_NOTIFICATION', 'SERVER_NOTIFICATION', 'CHANNEL_NOTIFICATION', 'DM_NOTIFICATION');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "topic" VARCHAR(100),
    "message" VARCHAR(200),
    "notifyLink" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM_NOTIFICATION',
    "userId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
