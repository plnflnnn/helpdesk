-- Admins now create users with a password; invite links are gone.

-- DropForeignKey
ALTER TABLE "invites" DROP CONSTRAINT "invites_userId_fkey";

-- DropTable
DROP TABLE "invites";
