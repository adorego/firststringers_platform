-- CreateTable
CREATE TABLE "dossier_changes" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previous" JSONB,
    "current" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dossier_changes_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "dossier_changes_athleteId_createdAt_idx" ON "dossier_changes"("athleteId", "createdAt");
-- AddForeignKey
ALTER TABLE "dossier_changes" ADD CONSTRAINT "dossier_changes_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
