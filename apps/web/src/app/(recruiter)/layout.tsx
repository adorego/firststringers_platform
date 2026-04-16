import { RecruiterNav } from "@/components/ui/Sidebar";

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <RecruiterNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
