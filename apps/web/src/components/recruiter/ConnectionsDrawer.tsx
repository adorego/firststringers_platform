"use client";

import { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import {
  DirectConversation,
  fetchRecruiterConversations,
} from "@/hooks/useDirectChat";

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
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchRecruiterConversations(recruiterId)
      .then((data) => setConversations(data))
      .finally(() => setLoading(false));
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
              {!loading && (
                <span className="text-sm text-[#ADA8A5]">
                  {conversations.length} active
                </span>
              )}
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
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-[#ADA8A5]">Loading…</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-7 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEAE5]">
                <Users size={20} className="text-[#ADA8A5]" />
              </div>
              <p className="font-semibold text-[#1A1A1A]">No active connections yet</p>
              <p className="mt-1 text-sm text-[#ADA8A5]">
                Accepted conversations with athletes will appear here.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const athlete = conv.athlete;
              const lastMsg = conv.messages?.[0];

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv)}
                  className="flex w-full items-start gap-4 px-7 py-5 text-left transition-colors hover:bg-[#F0EDE9]"
                >
                  {/* Avatar */}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-base font-bold text-[#6B6561]">
                    {athlete?.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2) ?? "?"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#1A1A1A]">{athlete?.name}</p>
                      {lastMsg && (
                        <TimeAgo date={lastMsg.createdAt} />
                      )}
                    </div>
                    <p className="text-sm text-[#ADA8A5]">
                      {[athlete?.position, athlete?.sport].filter(Boolean).join(" · ")}
                    </p>
                    {lastMsg && (
                      <p className="mt-1 line-clamp-2 text-sm text-[#4B4745]">
                        {lastMsg.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
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
