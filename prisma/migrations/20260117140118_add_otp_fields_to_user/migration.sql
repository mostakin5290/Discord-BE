-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOtpVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otpExpires" TIMESTAMP(3),
ADD COLUMN     "resetOtp" TEXT;
