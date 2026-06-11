"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, User, NotebookTabs } from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
  badge?: boolean;
}

const jerryIcon = (
  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3D3D3D]">
    <div className="h-1.5 w-1.5 rounded-full bg-[#F5F5F0]" />
  </div>
);

const jerryIconActive = (
  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2D2D2D]">
    <div className="h-1.5 w-1.5 rounded-full bg-[#F5F5F0]" />
  </div>
);

const items: NavItem[] = [
  {
    href: "/chat",
    icon: jerryIcon,
    activeIcon: jerryIconActive,
    label: "Jerry",
  },
  {
    href: "/conversations",
    icon: <MessageCircle size={22} />,
    activeIcon: <MessageCircle size={22} />,
    label: "Conversations",
  },
  {
    href: "/dossier",
    icon: <NotebookTabs size={22} />,
    activeIcon: <NotebookTabs size={22} />,
    label: "Dossier",
  },
  {
    href: "/profile",
    icon: <User size={22} />,
    activeIcon: <User size={22} />,
    label: "Profile",
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-16 items-center border-t border-[#E8E8E4] bg-[#F5F5F0]">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2 transition-colors ${
              active
                ? "rounded-xl bg-[#E8E8E4] mx-1 text-[#2D2D2D]"
                : "text-[#A0A0A0] hover:text-[#6B6B6B]"
            }`}
          >
            <div className="relative">
              {active ? item.activeIcon : item.icon}
              {item.badge && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#3D3D3D]" />
              )}
            </div>
            <span className="text-[11px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
