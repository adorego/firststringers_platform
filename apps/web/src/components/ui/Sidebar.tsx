"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Layers,
  User,
  Settings,
  Search,
  Zap,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface SidebarProps {
  items: NavItem[];
}

export function AthleteNav() {
  const items: NavItem[] = [
    { href: "/chat", icon: <MessageSquare size={20} />, label: "Chat" },
    { href: "/pipeline", icon: <Layers size={20} />, label: "Pipeline" },
    { href: "/profile", icon: <User size={20} />, label: "Profile" },
  ];
  return <Sidebar items={items} />;
}

export function RecruiterNav() {
  const items: NavItem[] = [
    { href: "/search", icon: <Search size={20} />, label: "Search" },
    { href: "/matches", icon: <Zap size={20} />, label: "Matches" },
  ];
  return <Sidebar items={items} />;
}

function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[72px] flex-col items-center border-r border-fs-border-gray bg-white pt-6 pb-6">
      {/* Logo */}
      <Link
        href="/"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-white"
      >
        FS
      </Link>

      {/* Nav icons */}
      <nav className="mt-6 flex flex-col items-center gap-4">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                active
                  ? "bg-[#111827] text-white"
                  : "text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
              }`}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <Link
        href="/profile"
        title="Settings"
        className="flex h-12 w-12 items-center justify-center rounded-2xl text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
      >
        <Settings size={22} />
      </Link>
    </aside>
  );
}
