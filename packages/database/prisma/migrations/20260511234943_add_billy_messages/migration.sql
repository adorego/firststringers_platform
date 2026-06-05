-- CreateTable
CREATE TABLE "billy_messages" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billy_messages_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "billy_messages" ADD CONSTRAINT "billy_messages_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "Recruiter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
