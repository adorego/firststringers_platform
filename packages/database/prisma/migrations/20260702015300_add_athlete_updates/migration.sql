-- CreateTable
CREATE TABLE "athlete_updates" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "athlete_updates_athleteId_createdAt_idx" ON "athlete_updates"("athleteId", "createdAt");

-- AddForeignKey
ALTER TABLE "athlete_updates" ADD CONSTRAINT "athlete_updates_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
