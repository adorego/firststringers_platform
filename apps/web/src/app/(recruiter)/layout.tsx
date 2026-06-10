import { RecruiterShell } from "@/components/recruiter/RecruiterShell";

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RecruiterShell>{children}</RecruiterShell>;
}
