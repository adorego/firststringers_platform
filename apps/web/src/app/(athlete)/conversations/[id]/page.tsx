"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Send } from "lucide-react";
import {
  useDirectChat,
  type DirectConversation,
} from "@/hooks/useDirectChat";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConversationThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: conversationId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [recruiterName, setRecruiterName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const athleteId = session?.user?.athleteId ?? "";

  const { messages, connected, sendMessage } = useDirectChat(
    athleteId ? conversationId : null,
    athleteId,
    "athlete",
  );

  // Resolve recruiter name from the conversation list
  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    fetch(`${API_URL}/conversations/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DirectConversation[]) => {
        const conv = data.find((c) => c.id === conversationId);
        setRecruiterName(conv?.recruiter?.name ?? "Recruiter");
      })
      .catch(() => setRecruiterName("Recruiter"));
  }, [session?.accessToken, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !connected) return;
    sendMessage(trimmed);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-5 pb-3">
        <button
          onClick={() => router.push("/conversations")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fs-text-muted transition-colors hover:bg-fs-surface"
          aria-label="Back to conversations"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fs-text text-sm font-semibold text-white">
          {(recruiterName ?? "R").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-bold text-fs-text">
            {recruiterName ?? "…"}
          </h1>
          <p className="text-sm text-fs-text-muted">
            {connected ? "Recruiter" : "Connecting…"}
          </p>
        </div>
      </header>

      <div className="mx-6 h-px bg-fs-surface-alt" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.length === 0 && (
            <p className="mt-8 text-center text-sm text-fs-text-muted">
              This is the beginning of your conversation.
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.senderRole === "athlete" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 ${
                  msg.senderRole === "athlete"
                    ? "bg-fs-text text-white"
                    : "bg-fs-surface text-fs-text"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p
                  className={`mt-1 text-xs ${
                    msg.senderRole === "athlete"
                      ? "text-white/40"
                      : "text-fs-text-muted"
                  }`}
                >
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-4 pt-2">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Write a message"
            className="flex-1 rounded-full border border-fs-border bg-white px-5 py-3 text-sm text-fs-text placeholder-fs-text-muted outline-none transition-colors focus:border-[#C0C0BC]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-fs-text text-white transition-opacity disabled:opacity-30"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
