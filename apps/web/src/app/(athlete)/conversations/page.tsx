"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type DirectConversation,
  fetchPendingRequests,
  acceptConnectionRequest,
  declineConnectionRequest,
} from "@/hooks/useDirectChat";

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
  const [pendingRequests, setPendingRequests] = useState<DirectConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    Promise.all([
      fetch(`${API_URL}/conversations/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
      fetchPendingRequests(token),
    ])
      .then(([accepted, pending]) => {
        setConversations(accepted);
        setPendingRequests(pending);
      })
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  async function handleAccept(conv: DirectConversation) {
    const token = session?.accessToken;
    if (!token) return;
    setActionLoading(conv.id);
    const accepted = await acceptConnectionRequest(conv.id, token);
    if (accepted) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== conv.id));
      setConversations((prev) => [{ ...conv, status: "accepted" as const }, ...prev]);
    }
    setActionLoading(null);
  }

  async function handleDecline(conv: DirectConversation) {
    const token = session?.accessToken;
    if (!token) return;
    setActionLoading(conv.id);
    const ok = await declineConnectionRequest(conv.id, token);
    if (ok) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== conv.id));
    }
    setActionLoading(null);
  }

  const isEmpty = conversations.length === 0 && pendingRequests.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-fs-text">Conversations</h1>
        <p className="mt-1 text-sm text-fs-text-muted">
          Active recruiting discussions
        </p>
      </header>

      <div className="mx-6 mt-2 h-px bg-fs-surface-alt" />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-fs-text-muted">Loading…</p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-fs-surface">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fs-border">
              <div className="h-2 w-2 rounded-full bg-[#C0C0BC]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-fs-text">
            No active conversations yet
          </h2>
          <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-fs-text-muted">
            When coaches request an introduction and you accept, your
            conversations will appear here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-fs-text-muted">
                  Pending requests
                </h2>
                <div className="space-y-3">
                  {pendingRequests.map((req) => {
                    const isActing = actionLoading === req.id;
                    return (
                      <div
                        key={req.id}
                        className="flex w-full items-start gap-3 rounded-2xl bg-fs-bg px-5 py-4 border border-[#E0DDD8]"
                      >
                        {/* Avatar */}
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-fs-text text-sm font-semibold text-white">
                          {(req.recruiter?.name ?? "R").charAt(0).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-fs-text">
                            {req.recruiter?.name ?? "Recruiter"}
                          </p>
                          {req.recruiter?.organization?.name && (
                            <p className="text-xs text-fs-text-muted">
                              {req.recruiter.organization.name}
                            </p>
                          )}
                          {req.recruiter?.pitch && (
                            <p className="mt-2 text-sm leading-relaxed text-[#4B4745]">
                              {req.recruiter.pitch}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-fs-text-muted">
                            {formatTime(req.createdAt)}
                          </p>

                          {/* Accept / Decline */}
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleAccept(req)}
                              disabled={isActing}
                              className="rounded-xl bg-fs-text px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            >
                              {isActing ? "…" : "Accept"}
                            </button>
                            <button
                              onClick={() => handleDecline(req)}
                              disabled={isActing}
                              className="rounded-xl bg-fs-surface px-4 py-2 text-sm font-medium text-fs-text transition-colors hover:bg-[#E5E5E1] disabled:opacity-50"
                            >
                              {isActing ? "…" : "Decline"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Active conversations */}
            {conversations.length > 0 && (
              <section>
                {pendingRequests.length > 0 && (
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-fs-text-muted">
                    Active
                  </h2>
                )}
                <div className="space-y-2">
                  {conversations.map((conv) => {
                    const lastMessage = conv.messages?.[0];
                    const unread =
                      lastMessage?.senderRole === "recruiter" &&
                      lastMessage.readAt === null;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => router.push(`/conversations/${conv.id}`)}
                        className="flex w-full items-center gap-3 rounded-2xl bg-fs-surface px-5 py-4 text-left transition-colors hover:bg-[#E5E5E1]"
                      >
                        {/* Avatar */}
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-fs-text text-sm font-semibold text-white">
                          {(conv.recruiter?.name ?? "R").charAt(0).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate font-semibold text-fs-text">
                              {conv.recruiter?.name ?? "Recruiter"}
                            </p>
                            {lastMessage && (
                              <span className="ml-2 flex-shrink-0 text-xs text-fs-text-muted">
                                {formatTime(lastMessage.createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between">
                            <p
                              className={`truncate text-sm ${
                                unread
                                  ? "font-medium text-fs-text"
                                  : "text-fs-text-muted"
                              }`}
                            >
                              {lastMessage?.content ?? "Start the conversation"}
                            </p>
                            {unread && (
                              <span className="ml-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-fs-text" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
