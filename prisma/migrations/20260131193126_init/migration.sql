-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "systemChannelId" TEXT,
ADD COLUMN     "systemMessageFlags" JSONB;

-- CreateTable
CREATE TABLE "BannedUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#99AAB5',
    "permissions" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MemberToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MemberToRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "BannedUser_userId_idx" ON "BannedUser"("userId");

-- CreateIndex
CREATE INDEX "BannedUser_serverId_idx" ON "BannedUser"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "BannedUser_userId_serverId_key" ON "BannedUser"("userId", "serverId");

-- CreateIndex
CREATE INDEX "Role_serverId_idx" ON "Role"("serverId");

-- CreateIndex
CREATE INDEX "_MemberToRole_B_index" ON "_MemberToRole"("B");

-- AddForeignKey
ALTER TABLE "BannedUser" ADD CONSTRAINT "BannedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannedUser" ADD CONSTRAINT "BannedUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToRole" ADD CONSTRAINT "_MemberToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToRole" ADD CONSTRAINT "_MemberToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
