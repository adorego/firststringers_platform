"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";
import { useDirectChat, DirectConversation } from "@/hooks/useDirectChat";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric" });
}

interface DirectChatPanelProps {
  conversation: DirectConversation;
  recruiterId: string;
  onBack: () => void;
}

export function DirectChatPanel({ conversation, recruiterId, onBack }: DirectChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, connected, sendMessage } = useDirectChat(
    conversation.id,
    recruiterId,
    "recruiter",
  );

  const athlete = conversation.athlete;
  const athleteName = athlete?.name ?? "Athlete";
  const athleteInitials = athleteName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const athleteMeta = [athlete?.position, athlete?.sport].filter(Boolean).join(" · ");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !connected) return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  }, [input, connected, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by day for date dividers
  const grouped: { date: string; msgs: typeof messages }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: dateKey, msgs: [msg] });
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-[#F5F5F0]" style={{ zIndex: 60 }}>
      {/* Header — safe area top for notch */}
      <header
        className="flex flex-shrink-0 items-center gap-3 px-6 pt-5 pb-3"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#EDEDEA]"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3D3D3D] text-sm font-semibold text-white">
          {athleteInitials}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-[#2D2D2D]">{athleteName}</h1>
          <p className="truncate text-sm text-[#A0A0A0]">{athleteMeta || "Athlete"}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-[#3D3D3D]" : "bg-[#C0C0BC]"}`}
          />
          <span className="hidden text-xs text-[#A0A0A0] sm:inline">
            {connected ? "Online" : "Connecting…"}
          </span>
        </div>
      </header>

      <div className="mx-6 h-px bg-[#E8E8E4]" />

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.length === 0 && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDEDEA] text-xl font-bold text-[#6B6B6B]">
                {athleteInitials}
              </div>
              <p className="font-semibold text-[#2D2D2D]">{athleteName}</p>
              {athleteMeta && <p className="text-sm text-[#A0A0A0]">{athleteMeta}</p>}
              <p className="mt-2 text-xs text-[#A0A0A0]">No messages yet. Say hello!</p>
            </div>
          )}

          {grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date divider */}
              <div className="my-3 flex items-center gap-3">
                <div className="flex-1 border-t border-[#E8E8E4]" />
                <span className="text-xs text-[#A0A0A0]">{formatDateDivider(msgs[0].createdAt)}</span>
                <div className="flex-1 border-t border-[#E8E8E4]" />
              </div>

              {/* Messages for this day */}
              <div className="flex flex-col gap-1">
                {msgs.map((msg, idx) => {
                  const isRecruiter = msg.senderRole === "recruiter";
                  const isLastInGroup =
                    idx === msgs.length - 1 || msgs[idx + 1]?.senderRole !== msg.senderRole;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isRecruiter ? "justify-end" : "justify-start"}`}
                    >
                      {/* Athlete avatar — only on last in group */}
                      {!isRecruiter && (
                        <div className="mr-2 flex-shrink-0 self-end">
                          {isLastInGroup ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EDEDEA] text-xs font-bold text-[#6B6B6B]">
                              {athleteInitials}
                            </div>
                          ) : (
                            <div className="h-7 w-7" />
                          )}
                        </div>
                      )}

                      <div
                        className={`flex max-w-lg flex-col ${
                          isRecruiter ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            isRecruiter
                              ? "bg-[#3D3D3D] text-white"
                              : "bg-[#EDEDEA] text-[#2D2D2D]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                          </p>
                        </div>

                        {/* Timestamp + read receipt — only on last in group */}
                        {isLastInGroup && (
                          <div
                            className={`mt-1 flex items-center gap-1 ${
                              isRecruiter ? "flex-row-reverse" : "flex-row"
                            }`}
                          >
                            <span className="text-xs text-[#A0A0A0]">
                              {formatTime(msg.createdAt)}
                            </span>
                            {isRecruiter &&
                              (msg.readAt ? (
                                <CheckCheck size={12} className="text-[#3D3D3D]" />
                              ) : (
                                <Check size={12} className="text-[#A0A0A0]" />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input — safe area bottom for home indicator */}
      <div
        className="flex-shrink-0 px-6 pb-4 pt-2"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message"
            rows={1}
            style={{ maxHeight: "120px" }}
            className="flex-1 resize-none overflow-y-auto rounded-3xl border border-[#E0E0DC] bg-white px-5 py-3 text-sm text-[#2D2D2D] placeholder-[#A0A0A0] outline-none transition-colors focus:border-[#C0C0BC]"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#3D3D3D] text-white transition-opacity disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
