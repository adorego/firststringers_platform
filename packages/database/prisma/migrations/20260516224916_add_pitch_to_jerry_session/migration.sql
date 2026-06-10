-- AlterTable
ALTER TABLE "JerrySession" ADD COLUMN     "currentPitch" TEXT,
ADD COLUMN     "lastPitchAt" TIMESTAMP(3),
ADD COLUMN     "pitchVersion" INTEGER NOT NULL DEFAULT 0;
