-- Add seenBy column to Message table
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "seenBy" TEXT[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN "Message"."seenBy" IS 'Array of user IDs who have seen this message';
