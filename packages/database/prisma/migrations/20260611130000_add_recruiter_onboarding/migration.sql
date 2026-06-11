-- AlterTable: add onboarding fields to Recruiter
ALTER TABLE "Recruiter" ADD COLUMN "university" TEXT,
                        ADD COLUMN "location" TEXT,
                        ADD COLUMN "scholarshipType" TEXT,
                        ADD COLUMN "sport" TEXT,
                        ADD COLUMN "gender" TEXT,
                        ADD COLUMN "division" TEXT,
                        ADD COLUMN "openings" INTEGER,
                        ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add recruiterId to User
ALTER TABLE "User" ADD COLUMN "recruiterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_recruiterId_key" ON "User"("recruiterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
