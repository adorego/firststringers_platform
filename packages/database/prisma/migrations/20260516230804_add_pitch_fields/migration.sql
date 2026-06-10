/*
  Warnings:

  - A unique constraint covering the columns `[athleteId]` on the table `JerrySession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "JerrySession_athleteId_key" ON "JerrySession"("athleteId");
