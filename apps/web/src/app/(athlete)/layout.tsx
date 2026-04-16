import { AthleteNav } from "@/components/ui/Sidebar";

export default function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      <AthleteNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
