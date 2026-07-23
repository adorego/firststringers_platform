"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { MessageCircle, User } from "lucide-react";

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

function DossierIcon({ active = false }: { active?: boolean }) {
  const detailColor = active ? "#F5F5F0" : "currentColor";

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="5"
        y="3.75"
        width="14"
        height="16.5"
        rx="3"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="8"
        y="7"
        width="3.9"
        height="3.9"
        rx="1"
        fill={detailColor}
        opacity={active ? 0.95 : 0.72}
      />
      <path
        d="M13.6 7.65H16.45M13.6 10.25H16"
        stroke={detailColor}
        strokeLinecap="round"
        strokeWidth="1.45"
        opacity={active ? 0.9 : 0.58}
      />
      <path
        d="M8 14.15H16M8 17H14"
        stroke={detailColor}
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity={active ? 0.9 : 0.54}
      />
      <circle
        cx="18.25"
        cy="5.75"
        r="1.45"
        fill={detailColor}
        opacity={active ? 0.9 : 0.55}
      />
    </svg>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [hasUnreadConversations, setHasUnreadConversations] = useState(false);

  useEffect(() => {
    const token = session?.accessToken as string | undefined;
    if (!token) return;
    fetch(`${API_URL}/conversations/me/counts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { unreadConnections: 0 }))
      .then((data) => setHasUnreadConversations((data.unreadConnections ?? 0) > 0))
      .catch(() => {});
    // Re-check whenever the route changes — covers coming back from a
    // conversation thread right after its messages were marked read.
  }, [session?.accessToken, pathname]);

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
      badge: hasUnreadConversations,
    },
    {
      href: "/dossier",
      icon: <DossierIcon />,
      activeIcon: <DossierIcon active />,
      label: "Dossier",
    },
    {
      href: "/profile",
      icon: <User size={22} />,
      activeIcon: <User size={22} />,
      label: "Profile",
    },
  ];

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
            <span className={`text-[11px] ${item.badge ? "font-bold" : "font-medium"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
