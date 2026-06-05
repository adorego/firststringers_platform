-- DropForeignKey
ALTER TABLE "billy_conversations" DROP CONSTRAINT "billy_conversations_recruiterId_fkey";

-- CreateIndex
CREATE INDEX "billy_conversations_recruiterId_idx" ON "billy_conversations"("recruiterId");
