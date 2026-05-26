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
  Plus,
  Clock,
  ChevronDown,
  Users,
  Share2,
} from "lucide-react";

// ─── Recruiter Sidebar (wide, ChatGPT-style) ─────────────────────────────────

const MOCK_RECENT: string[] = [
  "Undervalued WRs — Fl...",
  "Defensive prospects — ...",
  "OL depth chart audit",
  "Transfer portal — skill p...",
  "Speed threats — South...",
  "Academic qualifiers — ...",
];

export function RecruiterSidebar({
  onPipelineClick,
  onConnectionsClick,
}: {
  onPipelineClick?: () => void;
  onConnectionsClick?: () => void;
}) {
  const pathname = usePathname();

  type NavItem =
    | { key: string; icon: React.ReactNode; label: string; count: number; onClick: () => void; href?: never }
    | { key: string; icon: React.ReactNode; label: string; count: number; href: string; onClick?: never };

  const navItems: NavItem[] = [
    { key: "pipeline", icon: <Layers size={15} />, label: "Pipeline", count: 3, onClick: onPipelineClick ?? (() => {}) },
    { key: "connections", icon: <Users size={15} />, label: "Connections", count: 2, onClick: onConnectionsClick ?? (() => {}) },
    { key: "introductions", href: "/introductions", icon: <Share2 size={15} />, label: "Introductions", count: 3 },
  ];

  return (
    <aside className="flex h-screen w-[272px] flex-shrink-0 flex-col bg-[#F5F0EB]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Link
          href="/"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#3B6FE8] text-xs font-black text-white"
        >
          FS
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1A1A1A]">
          First Stringers
        </span>
      </div>

      {/* New Search */}
      <div className="px-3 pb-3">
        <Link
          href="/billy"
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#1A1A1A] shadow-sm transition-colors hover:bg-[#EDE8E3]"
        >
          <Plus size={15} />
          New Search
        </Link>
      </div>

      {/* Nav items */}
      <nav className="space-y-0.5 px-2">
        {navItems.map((item) => {
          const active = "href" in item && item.href ? pathname === item.href : false;
          const cls = `flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
            active
              ? "bg-white/80 text-[#1A1A1A]"
              : "text-[#6B6561] hover:bg-white/50 hover:text-[#1A1A1A]"
          }`;
          const inner = (
            <>
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              <span className="text-xs text-[#ADA8A5]">{item.count}</span>
            </>
          );

          return "href" in item && item.href ? (
            <Link key={item.key} href={item.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <button key={item.key} onClick={item.onClick} className={cls}>
              {inner}
            </button>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="mx-4 my-3 border-t border-[#E4DDD7]" />

      {/* Recent searches */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#ADA8A5]">
          Recent
        </p>
        <div className="space-y-0.5">
          {MOCK_RECENT.map((title, i) => (
            <button
              key={i}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[#6B6561] transition-colors hover:bg-white/50 hover:text-[#1A1A1A]"
            >
              <Clock size={12} className="flex-shrink-0 text-[#C4BDBA]" />
              <span className="truncate">{title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* User profile */}
      <div className="border-t border-[#E4DDD7] px-2 py-3">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/50">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3B6FE8] text-xs font-bold text-white">
            M
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-[#1A1A1A]">Mike Thompson</p>
            <p className="text-xs text-[#ADA8A5]">Head Coach</p>
          </div>
          <ChevronDown size={14} className="text-[#ADA8A5]" />
        </button>
      </div>
    </aside>
  );
}

// ─── Athlete Nav (icon-only, unchanged) ───────────────────────────────────────

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
  return <IconSidebar items={items} />;
}

/** @deprecated Use RecruiterSidebar */
export function RecruiterNav() {
  const items: NavItem[] = [
    { href: "/search", icon: <Search size={20} />, label: "Search" },
    { href: "/matches", icon: <Zap size={20} />, label: "Matches" },
  ];
  return <IconSidebar items={items} />;
}

function IconSidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[72px] flex-col items-center border-r border-fs-border-gray bg-white pt-6 pb-6">
      <Link
        href="/"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#111827] text-sm font-black text-white"
      >
        FS
      </Link>

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

      <div className="flex-1" />

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
