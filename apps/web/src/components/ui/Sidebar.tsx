"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  ChevronUp,
  Users,
  Share2,
  X,
  HelpCircle,
  LogOut,
  ClipboardList,
} from "lucide-react";
import {
  listBillyConversations,
  createBillyConversation,
  BillyConversationSummary,
} from "@/hooks/useBilly";
import { LearnBillyPanel } from "@/components/recruiter/LearnBillyPanel";

// ─── Recruiter Sidebar ────────────────────────────────────────────────────────

export function RecruiterSidebar({
  recruiterId,
  onPipelineClick,
  onConnectionsClick,
  onIntroductionsClick,
  isOpen = false,
  onClose,
}: {
  recruiterId: string;
  onPipelineClick?: () => void;
  onConnectionsClick?: () => void;
  onIntroductionsClick?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<BillyConversationSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [learnBillyOpen, setLearnBillyOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!recruiterId) return;
    listBillyConversations(recruiterId).then(setConversations);
  }, [recruiterId]);

  const handleNewSearch = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const conv = await createBillyConversation(recruiterId);
      if (conv) {
        // Optimistically add to list
        setConversations((prev) => [
          {
            id: conv.id,
            recruiterId,
            title: "New search",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: null,
          },
          ...prev,
        ]);
        onClose?.();
        router.push(`/billy/${conv.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  type NavItem =
    | { key: string; icon: React.ReactNode; label: string; count: number; onClick: () => void; href?: never }
    | { key: string; icon: React.ReactNode; label: string; count: number; href: string; onClick?: never };

  const navItems: NavItem[] = [
    { key: "pipeline", icon: <Layers size={15} />, label: "Pipeline", count: 3, onClick: onPipelineClick ?? (() => {}) },
    { key: "connections", icon: <Users size={15} />, label: "Connections", count: 2, onClick: onConnectionsClick ?? (() => {}) },
    { key: "introductions", icon: <Share2 size={15} />, label: "Introductions", count: 3, onClick: onIntroductionsClick ?? (() => {}) },
  ];

  const closeOnMobile = () => onClose?.();

  return (
    <>
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 flex h-full w-[272px] flex-col bg-[#F5F0EB]
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        sm:relative sm:z-auto sm:h-screen sm:flex-shrink-0 sm:translate-x-0
      `}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-5"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <Link
          href="/"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#3B6FE8] text-xs font-black text-white"
        >
          FS
        </Link>
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-[#1A1A1A]">
          First Stringers
        </span>
        <button
          onClick={closeOnMobile}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#ADA8A5] transition-colors hover:bg-white/50 hover:text-[#1A1A1A] sm:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* New Search */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewSearch}
          disabled={creating}
          className="flex w-full items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#1A1A1A] shadow-sm transition-colors hover:bg-[#EDE8E3] disabled:opacity-50"
        >
          <Plus size={15} />
          {creating ? "Starting…" : "New Search"}
        </button>
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

      {/* Recent Billy conversations */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#ADA8A5]">
          Recent
        </p>
        <div className="space-y-0.5">
          {conversations.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#ADA8A5]">No searches yet</p>
          )}
          {conversations.map((conv) => {
            const isActive = pathname === `/billy/${conv.id}`;
            return (
              <Link
                key={conv.id}
                href={`/billy/${conv.id}`}
                onClick={closeOnMobile}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-white/80 text-[#1A1A1A]"
                    : "text-[#6B6561] hover:bg-white/50 hover:text-[#1A1A1A]"
                }`}
              >
                <Clock size={12} className="flex-shrink-0 text-[#C4BDBA]" />
                <span className="truncate">{conv.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User profile + dropdown */}
      <div ref={menuRef} className="relative border-t border-[#E4DDD7] px-2 py-3">
        {/* Dropdown menu — rendered above the trigger */}
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-[#E4DDD7] bg-white shadow-lg">
            {/* Menu items */}
            <div className="py-1">
              {[
                // { icon: <User size={15} />, label: "Profile", action: () => setMenuOpen(false) },
                // { icon: <Settings size={15} />, label: "Preferences", action: () => setMenuOpen(false) },
                // { icon: <Bell size={15} />, label: "Notifications", action: () => setMenuOpen(false) },
                // { icon: <Eye size={15} />, label: "Recruiting Visibility", action: () => setMenuOpen(false) },
                {
                  icon: <HelpCircle size={15} />,
                  label: "Learn Billy",
                  action: () => { setMenuOpen(false); setLearnBillyOpen(true); },
                },
              ].map(({ icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#4B4745] transition-colors hover:bg-[#F5F0EB] hover:text-[#1A1A1A]"
                >
                  <span className="text-[#ADA8A5]">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            <div className="border-t border-[#E4DDD7] py-1">
              <button
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#4B4745] transition-colors hover:bg-[#F5F0EB] hover:text-[#1A1A1A]"
              >
                <span className="text-[#ADA8A5]"><LogOut size={15} /></span>
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/50"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3B6FE8] text-xs font-bold text-white">
            M
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-[#1A1A1A]">Mike Thompson</p>
            <p className="text-xs text-[#ADA8A5]">Head Coach</p>
          </div>
          {menuOpen
            ? <ChevronUp size={14} className="text-[#ADA8A5]" />
            : <ChevronDown size={14} className="text-[#ADA8A5]" />
          }
        </button>
      </div>
    </aside>

    <LearnBillyPanel isOpen={learnBillyOpen} onClose={() => setLearnBillyOpen(false)} />
    </>
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
    { href: "/dossier", icon: <ClipboardList size={20} />, label: "Dossier" },
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
