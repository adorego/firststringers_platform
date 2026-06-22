-- Add extended onboarding fields to Recruiter table
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "organizationType" TEXT;
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "recruiterRole" TEXT;
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "positions" TEXT;
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "graduatingClasses" TEXT;
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "evaluationPriority" TEXT;
ALTER TABLE "Recruiter" ADD COLUMN IF NOT EXISTS "filterCriteria" TEXT;
