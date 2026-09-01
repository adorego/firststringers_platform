"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { Send, Radar, TrendingUp, Shield, Check, X } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { useDossierStore } from "@/stores/dossier-store";
import type { ConnectionRequest } from "@/stores/chat-store";

function JerryWelcomeCard() {
  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-fs-text text-white">
        {/* Header with avatar */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#4A4A4A]">
              <div className="h-2 w-2 rounded-full bg-[#B0B0B0]" />
            </div>
            <div>
              <p className="font-semibold leading-tight">Welcome to Jerry</p>
              <p className="text-xs text-white/50">
                Your AI representation partner
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            I track recruiting opportunities, monitor your development, and
            represent your interests. You can rely on me to surface what matters
            most for your journey.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-0">
          {[
            {
              icon: <Radar size={14} />,
              title: "Opportunity awareness",
              desc: "I monitor recruiting interest and surface what matters most for your consideration",
            },
            {
              icon: <TrendingUp size={14} />,
              title: "Development tracking",
              desc: "I observe your progression and how it shapes your opportunities",
            },
            {
              icon: <Shield size={14} />,
              title: "Representation",
              desc: "I advocate for your interests and help you navigate what comes next",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 px-5 py-3"
            >
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-white/40">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-center text-sm text-white/40">
            Share an update or ask a question to get started.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectionRequestCard({
  request,
  token,
}: {
  request: ConnectionRequest;
  token: string;
}) {
  const acceptRequest = useChatStore((s) => s.acceptRequest);
  const declineRequest = useChatStore((s) => s.declineRequest);
  const [busy, setBusy] = useState(false);

  const from = request.organizationName
    ? `${request.recruiterName} · ${request.organizationName}`
    : request.recruiterName;

  const handle = async (action: "accept" | "decline") => {
    setBusy(true);
    if (action === "accept") {
      await acceptRequest(request.conversationId, token);
    } else {
      await declineRequest(request.conversationId, token);
    }
    setBusy(false);
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-fs-border bg-white">
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fs-text-muted">
            Connection request
          </p>
          <p className="mt-1 text-sm font-semibold text-fs-text">{from}</p>
          {request.pitch ? (
            <p className="mt-2 text-sm leading-relaxed text-[#4B4B4B]">
              {request.pitch}
            </p>
          ) : (
            <p className="mt-1 text-sm text-fs-text-muted">
              wants to connect with you directly.
            </p>
          )}
        </div>
        <div className="flex border-t border-fs-surface-alt">
          <button
            onClick={() => handle("decline")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-fs-text-muted transition-colors hover:bg-fs-bg hover:text-[#E53E3E] disabled:opacity-40"
          >
            <X size={15} />
            Decline
          </button>
          <div className="w-px bg-fs-surface-alt" />
          <button
            onClick={() => handle("accept")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium text-fs-text transition-colors hover:bg-fs-bg disabled:opacity-40"
          >
            <Check size={15} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useChatStore((s) => s.messages);
  const isConnected = useChatStore((s) => s.isConnected);
  const isTyping = useChatStore((s) => s.isTyping);
  const error = useChatStore((s) => s.error);
  const pendingRequests = useChatStore((s) => s.pendingRequests);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearError = useChatStore((s) => s.clearError);

  const subscribe = useDossierStore((s) => s.subscribe);

  // Redirect if refresh token expired
  useEffect(() => {
    if (session?.error === "RefreshTokenExpired") {
      signOut({ callbackUrl: "/welcome" });
    }
  }, [session?.error]);

  useEffect(() => {
    const token = session?.accessToken as string | undefined;
    if (!token) return;

    const { connect, disconnect } = useChatStore.getState();
    connect(token);
    subscribe();

    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;
    sendMessage(trimmed);
    setInput("");
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Skip first jerry message (welcome) since we show the card instead
  const hasUserSent = messages.some((m) => m.sender === "athlete");
  const visibleMessages = messages.filter(
    (_, i) => !(i === 0 && messages[0]?.sender === "jerry"),
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-6 pt-2 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fs-text">
            <div className="h-2.5 w-2.5 rounded-full bg-fs-bg" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-fs-text">Jerry</h1>
            <p className="text-sm text-fs-text-muted">Always in your corner</p>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 flex items-center justify-between rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={clearError} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {/* Welcome card always first */}
          <JerryWelcomeCard />

          {/* Subsequent messages */}
          {visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "athlete" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender !== "athlete" && (
                <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fs-text">
                  <div className="h-2 w-2 rounded-full bg-fs-bg" />
                </div>
              )}
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 ${
                  msg.sender === "athlete"
                    ? "bg-fs-text text-white"
                    : "bg-fs-surface text-fs-text"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p
                  className={`mt-1 text-xs ${
                    msg.sender === "athlete" ? "text-white/40" : "text-fs-text-muted"
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Suggestions — before user sends first message */}
          {!hasUserSent && (
            <div className="mt-2 text-center">
              <p className="mb-3 text-xs text-fs-text-muted">You can ask me</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Show me my overview",
                  "What are you tracking right now?",
                  "How is my progress looking?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border border-fs-border bg-white px-3 py-1.5 text-sm text-fs-text-muted transition-colors hover:border-[#C0C0BC] hover:text-fs-text"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connection request cards */}
          {pendingRequests.map((req) => (
            <ConnectionRequestCard
              key={req.conversationId}
              request={req}
              token={session?.accessToken as string}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fs-text">
                <div className="h-2 w-2 rounded-full bg-fs-bg" />
              </div>
              <div className="rounded-2xl bg-fs-surface px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-fs-text-muted [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-fs-text-muted [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-fs-text-muted [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-2xl border border-fs-border bg-white px-4 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Share an update or ask a question"
              className="flex-1 bg-transparent text-sm text-fs-text placeholder:text-fs-text-muted focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isConnected}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-fs-surface text-fs-text-muted transition-colors hover:bg-fs-border disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
