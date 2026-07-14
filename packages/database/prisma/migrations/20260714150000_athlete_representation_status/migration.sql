ALTER TABLE "Athlete" ADD COLUMN "representationStatus" TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE "Athlete" ADD COLUMN "representedAt" TIMESTAMP(3);

UPDATE "Athlete" a
SET "representationStatus" = 'represented',
    "representedAt"        = d."updatedAt"
FROM "Dossier" d
WHERE d."athleteId" = a.id
  AND d.data->'identity'->>'sport' IS NOT NULL
  AND d.data->'identity'->>'position' IS NOT NULL
  AND d.data->'identity'->>'graduationYear' IS NOT NULL
  AND d.data->'identity'->>'location' IS NOT NULL
  AND d.data->'identity'->>'school' IS NOT NULL
  AND d.data->'performance'->'stats' IS NOT NULL
  AND jsonb_array_length(COALESCE(d.data->'performance'->'strengths', '[]'::jsonb)) > 0
  AND d.data->'availability'->>'competitiveLevelGoal' IS NOT NULL
  AND jsonb_array_length(COALESCE(d.data->'availability'->'goals', '[]'::jsonb)) > 0;

UPDATE "Athlete" a
SET "representationStatus" = 'activation'
FROM "JerrySession" s
WHERE s."athleteId" = a.id
  AND a."representationStatus" = 'registered';
