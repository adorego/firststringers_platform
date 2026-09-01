import { BottomNav } from "@/components/ui/BottomNav";
import { BrandBar } from "@/components/ui/BrandBar";

export default function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-fs-bg">
      <BrandBar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
