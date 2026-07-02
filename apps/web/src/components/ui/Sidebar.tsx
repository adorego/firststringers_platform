"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listBillyConversations,
  createBillyConversation,
  renameBillyConversation,
  deleteBillyConversation,
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
  refreshCountsKey,
}: {
  recruiterId: string;
  onPipelineClick?: () => void;
  onConnectionsClick?: () => void;
  onIntroductionsClick?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  // Bump this (e.g. drawer open/close, active chat id) to re-fetch unread counts
  // so the Connections badge clears once a conversation has been read.
  refreshCountsKey?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const displayName = session?.user?.name ?? session?.user?.email ?? "Recruiter";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [conversations, setConversations] = useState<BillyConversationSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [counts, setCounts] = useState({ pipeline: 0, connections: 0, introductions: 0, unreadConnections: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [learnBillyOpen, setLearnBillyOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const token = session?.accessToken as string | undefined;
    if (!token) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_URL}/pipeline`, { headers })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API_URL}/conversations/me/counts`, { headers })
        .then((r) => (r.ok ? r.json() : { connections: 0, introductions: 0, unreadConnections: 0 }))
        .catch(() => ({ connections: 0, introductions: 0, unreadConnections: 0 })),
    ]).then(([pipeline, convCounts]) => {
      setCounts({
        pipeline: Array.isArray(pipeline) ? pipeline.length : 0,
        connections: convCounts.connections ?? 0,
        introductions: convCounts.introductions ?? 0,
        unreadConnections: convCounts.unreadConnections ?? 0,
      });
    });
    // refreshCountsKey changes when a connection's chat opens/closes so the
    // unread badge clears once messages have actually been read server-side.
  }, [session?.accessToken, refreshCountsKey]);

  const startEditing = (conv: BillyConversationSummary, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const commitEdit = async (id: string) => {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
    await renameBillyConversation(id, title);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await deleteBillyConversation(id);
    if (pathname === `/billy/${id}`) {
      router.push("/billy");
    }
  };

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
    | { key: string; icon: React.ReactNode; label: string; count: number; unread?: boolean; onClick: () => void; href?: never }
    | { key: string; icon: React.ReactNode; label: string; count: number; unread?: boolean; href: string; onClick?: never };

  const navItems: NavItem[] = [
    { key: "pipeline", icon: <Layers size={15} />, label: "Pipeline", count: counts.pipeline, onClick: onPipelineClick ?? (() => {}) },
    { key: "connections", icon: <Users size={15} />, label: "Connections", count: counts.connections, unread: counts.unreadConnections > 0, onClick: onConnectionsClick ?? (() => {}) },
    { key: "introductions", icon: <Share2 size={15} />, label: "Introductions", count: counts.introductions, onClick: onIntroductionsClick ?? (() => {}) },
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
                <span className="relative flex">
                  {item.icon}
                  {item.unread && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#3B6FE8]" />
                  )}
                </span>
                <span className={item.unread ? "font-semibold" : undefined}>{item.label}</span>
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
            const isEditing = editingId === conv.id;
            return (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-white/80 text-[#1A1A1A]"
                    : "text-[#6B6561] hover:bg-white/50 hover:text-[#1A1A1A]"
                }`}
              >
                <Clock size={12} className="flex-shrink-0 text-[#C4BDBA]" />

                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => commitEdit(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(conv.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#1A1A1A] focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <Link
                    href={`/billy/${conv.id}`}
                    onClick={closeOnMobile}
                    className="min-w-0 flex-1 truncate"
                  >
                    {conv.title}
                  </Link>
                )}

                {!isEditing && (
                  <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => startEditing(conv, e)}
                      title="Rename"
                      className="flex h-6 w-6 items-center justify-center rounded text-[#ADA8A5] hover:bg-black/5 hover:text-[#1A1A1A]"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      title="Delete"
                      className="flex h-6 w-6 items-center justify-center rounded text-[#ADA8A5] hover:bg-black/5 hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
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
                onClick={() => signOut({ callbackUrl: "/welcome/returning" })}
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
            {initials}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-[#1A1A1A]">{displayName}</p>
            <p className="text-xs text-[#ADA8A5]">Recruiter</p>
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
