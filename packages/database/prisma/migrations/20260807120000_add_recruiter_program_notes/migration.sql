-- Add free-text program notes collected during the short onboarding form
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "programNotes" TEXT;
