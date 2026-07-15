-- Create pipeline_entries table for recruiter "Add to Pipeline" tracking
CREATE TABLE "pipeline_entries" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pipeline_entries_recruiterId_athleteId_key" ON "pipeline_entries"("recruiterId", "athleteId");

ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipeline_entries" ADD CONSTRAINT "pipeline_entries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
