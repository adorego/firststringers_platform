CREATE TABLE "OwnersManual" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnersManual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnersManual_athleteId_key" ON "OwnersManual"("athleteId");

ALTER TABLE "OwnersManual" ADD CONSTRAINT "OwnersManual_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
