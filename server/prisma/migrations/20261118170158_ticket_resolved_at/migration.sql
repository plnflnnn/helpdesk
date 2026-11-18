-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- Existing resolved and closed tickets: their last update is the best guess for when they were resolved.
UPDATE "tickets" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('resolved', 'closed');
