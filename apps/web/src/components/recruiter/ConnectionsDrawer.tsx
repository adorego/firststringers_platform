"use client";

import { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import {
  DirectConversation,
  fetchRecruiterConversations,
} from "@/hooks/useDirectChat";

// Mock fallback while backend is not seeded
const MOCK_CONVERSATIONS: DirectConversation[] = [
  {
    id: "conv-1",
    recruiterId: "e0b6c0c8-2b27-4521-9b26-46ace16b4983",
    athleteId: "ath-1",
    athlete: { id: "ath-1", name: "Cameron Davis", sport: "Football", position: "QB" },
    messages: [
      {
        id: "m1",
        conversationId: "conv-1",
        senderId: "ath-1",
        senderRole: "athlete",
        content: "Thanks Coach, I'd love to learn more about your offensive philosophy.",
        readAt: null,
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
    ],
    status: "accepted" as const,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: "conv-2",
    recruiterId: "e0b6c0c8-2b27-4521-9b26-46ace16b4983",
    athleteId: "ath-2",
    athlete: { id: "ath-2", name: "Jordan Williams", sport: "Football", position: "LB" },
    messages: [
      {
        id: "m2",
        conversationId: "conv-2",
        senderId: "ath-2",
        senderRole: "athlete",
        content: "Coach, I just uploaded new spring camp footage focused on coverage work.",
        readAt: null,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    status: "accepted" as const,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_SCHOOL: Record<string, string> = {
  "ath-1": "Lincoln HS",
  "ath-2": "Northside HS",
};

const MOCK_YEAR: Record<string, number> = {
  "ath-1": 2026,
  "ath-2": 2027,
};

const MOCK_ONLINE: Record<string, boolean> = {
  "ath-1": true,
  "ath-2": false,
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TimeAgo({ date }: { date: Date | string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const d = typeof date === 'string' ? date : date.toISOString();
    setLabel(timeAgo(d));
    const interval = setInterval(() => setLabel(timeAgo(d)), 60000);
    return () => clearInterval(interval);
  }, [date]);

  if (!label) return null;

  return (
    <span className="flex-shrink-0 text-xs text-[#ADA8A5]">
      {label}
    </span>
  );
}

interface ConnectionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recruiterId: string;
  onSelectConversation: (conv: DirectConversation) => void;
}

export function ConnectionsDrawer({
  isOpen,
  onClose,
  recruiterId,
  onSelectConversation,
}: ConnectionsDrawerProps) {
  const [conversations, setConversations] = useState<DirectConversation[]>(MOCK_CONVERSATIONS);

  useEffect(() => {
    if (!isOpen) return;
    fetchRecruiterConversations(recruiterId).then((data) => {
      setConversations(data.length > 0 ? data : MOCK_CONVERSATIONS);
    });
  }, [isOpen, recruiterId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[520px] max-w-[90vw] flex-col bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E3DD] px-7 py-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Connections</h2>
              <span className="text-sm text-[#ADA8A5]">
                {conversations.length} active
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#ADA8A5]">
              Active recruiting conversations
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E8E3DD]">
          {conversations.map((conv) => {
            const athlete = conv.athlete;
            const lastMsg = conv.messages?.[0];
            const isOnline = MOCK_ONLINE[conv.athleteId] ?? false;
            const school = MOCK_SCHOOL[conv.athleteId] ?? "";
            const year = MOCK_YEAR[conv.athleteId] ?? "";

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className="flex w-full items-start gap-4 px-7 py-5 text-left transition-colors hover:bg-[#F0EDE9]"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDEAE5] text-base font-bold text-[#6B6561]">
                    {athlete?.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2) ?? "?"}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-[#FAFAF9] bg-[#3B6FE8]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#1A1A1A]">{athlete?.name}</p>
                    {lastMsg && (
                      <TimeAgo date={lastMsg.createdAt} />
                    )}
                  </div>
                  <p className="text-sm text-[#ADA8A5]">
                    {[athlete?.position, year, school].filter(Boolean).join(" · ")}
                  </p>
                  {lastMsg && (
                    <p className="mt-1 line-clamp-2 text-sm text-[#4B4745]">
                      {lastMsg.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Info card */}
        <div className="border-t border-[#E8E3DD] px-7 py-5">
          <div className="flex items-start gap-3 rounded-xl bg-[#F0EDE9] px-4 py-4">
            <Users size={16} className="mt-0.5 flex-shrink-0 text-[#ADA8A5]" />
            <p className="text-sm leading-relaxed text-[#4B4745]">
              Connections are active recruiting conversations. Billy and Jerry
              facilitate introductions and provide contextual intelligence to
              support meaningful relationships.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
