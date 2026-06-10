"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { DirectConversation } from "@/hooks/useDirectChat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    fetch(`${API_URL}/conversations/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DirectConversation[]) => setConversations(data))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Conversations</h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Active recruiting discussions
        </p>
      </header>

      <div className="mx-6 mt-2 h-px bg-[#E8E8E4]" />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#A0A0A0]">Loading…</p>
        </div>
      ) : conversations.length === 0 ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#EDEDEA]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0E0DC]">
              <div className="h-2 w-2 rounded-full bg-[#C0C0BC]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#2D2D2D]">
            No active conversations yet
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[#A0A0A0]">
            When coaches request an introduction and you accept, your
            conversations will appear here.
          </p>
        </div>
      ) : (
        /* Conversation list */
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            {conversations.map((conv) => {
              const lastMessage = conv.messages?.[0];
              const unread =
                lastMessage?.senderRole === "recruiter" &&
                lastMessage.readAt === null;

              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/conversations/${conv.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-[#EDEDEA] px-5 py-4 text-left transition-colors hover:bg-[#E5E5E1]"
                >
                  {/* Avatar */}
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#3D3D3D] text-sm font-semibold text-white">
                    {(conv.recruiter?.name ?? "R").charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-semibold text-[#2D2D2D]">
                        {conv.recruiter?.name ?? "Recruiter"}
                      </p>
                      {lastMessage && (
                        <span className="ml-2 flex-shrink-0 text-xs text-[#A0A0A0]">
                          {formatTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <p
                        className={`truncate text-sm ${
                          unread
                            ? "font-medium text-[#2D2D2D]"
                            : "text-[#A0A0A0]"
                        }`}
                      >
                        {lastMessage?.content ?? "Start the conversation"}
                      </p>
                      {unread && (
                        <span className="ml-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#3D3D3D]" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
