"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";
import { useDirectChat, DirectConversation } from "@/hooks/useDirectChat";

const MOCK_RECRUITER_ID = "e0b6c0c8-2b27-4521-9b26-46ace16b4983";

// Shown when backend has no messages yet
const t = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

const MOCK_MESSAGES = [
  {
    id: "m1", conversationId: "conv-1",
    senderId: MOCK_RECRUITER_ID, senderRole: "recruiter" as const,
    content: "Hey Cameron, I came across your profile through our scouting system. Your footwork and arm mechanics on film really stood out. Have you had any official visits yet?",
    readAt: t(0), createdAt: t(52),
  },
  {
    id: "m2", conversationId: "conv-1",
    senderId: "ath-1", senderRole: "athlete" as const,
    content: "Hey Coach! Not yet — a few schools have reached out but nothing official. Your program has honestly been on my radar for a while.",
    readAt: null, createdAt: t(50),
  },
  {
    id: "m3", conversationId: "conv-1",
    senderId: MOCK_RECRUITER_ID, senderRole: "recruiter" as const,
    content: "Good to hear. We run a spread RPO system — it's designed for dual-threat QBs who can process quickly. Your 67% completion rate last season and 4.62 forty are exactly the profile we look for.",
    readAt: t(0), createdAt: t(48),
  },
  {
    id: "m4", conversationId: "conv-1",
    senderId: "ath-1", senderRole: "athlete" as const,
    content: "I didn't realize you had tracked those numbers. What would an official visit look like on your end?",
    readAt: null, createdAt: t(45),
  },
  {
    id: "m5", conversationId: "conv-1",
    senderId: MOCK_RECRUITER_ID, senderRole: "recruiter" as const,
    content: "We'd fly you and your family in for the weekend. Full campus tour, meetings with the offense staff, and you'd work directly with Coach Davis in a private QB session. We have two spots left in the 2026 class.",
    readAt: t(0), createdAt: t(43),
  },
  {
    id: "m6", conversationId: "conv-1",
    senderId: "ath-1", senderRole: "athlete" as const,
    content: "That sounds incredible. When would the visit be?",
    readAt: null, createdAt: t(40),
  },
  {
    id: "m7", conversationId: "conv-1",
    senderId: MOCK_RECRUITER_ID, senderRole: "recruiter" as const,
    content: "We have an opening the weekend of June 14th. Would that work for you and your parents?",
    readAt: t(0), createdAt: t(10),
  },
  {
    id: "m8", conversationId: "conv-1",
    senderId: "ath-1", senderRole: "athlete" as const,
    content: "Thanks Coach, I'd love to learn more about your offensive philosophy. I'll check with my parents tonight and confirm tomorrow morning! 🏈",
    readAt: null, createdAt: t(2),
  },
];

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
  onBack: () => void;
}

export function DirectChatPanel({ conversation, onBack }: DirectChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages: liveMessages, connected, sendMessage } = useDirectChat(
    conversation.id,
    MOCK_RECRUITER_ID,
    "recruiter",
  );

  // Use live messages when available, fall back to mock for preview
  const messages = liveMessages.length > 0 ? liveMessages : MOCK_MESSAGES;

  const athlete = conversation.athlete;
  const athleteName = athlete?.name ?? "Cameron Davis";
  const athleteInitials = athleteName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    // If live connection available, send real; otherwise append optimistically to mock
    if (connected) {
      sendMessage(input.trim());
    }
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
    <div
      className="fixed inset-0 z-60 flex flex-col bg-[#FAFAF9]"
      style={{ zIndex: 60 }}
    >
      {/* Header — safe area top for notch */}
      <div
        className="flex flex-shrink-0 items-center gap-3 border-b border-[#E8E3DD] bg-[#FAFAF9] px-3 py-3 sm:gap-4 sm:px-5 sm:py-4"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A] active:bg-[#EDEAE5]"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-sm font-bold text-[#6B6561]">
          {athleteInitials}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1A1A1A] truncate text-sm sm:text-base">
            {athleteName}
          </p>
          <p className="text-xs text-[#ADA8A5]">
            {[athlete?.position, athlete?.sport].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-[#3B6FE8]" : "bg-[#ADA8A5]"
            }`}
          />
          <span className="hidden text-xs text-[#ADA8A5] sm:inline">
            {connected ? "Online" : "Connecting…"}
          </span>
        </div>
      </div>

      {/* Messages — min-h-0 so flex-1 scrolls correctly on mobile */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDEAE5] text-xl font-bold text-[#6B6561]">
              {athleteInitials}
            </div>
            <p className="font-semibold text-[#1A1A1A]">{athleteName}</p>
            <p className="text-sm text-[#ADA8A5]">
              {[athlete?.position, athlete?.sport].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-[#ADA8A5]">
              No messages yet. Say hello!
            </p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date divider */}
            <div className="my-3 flex items-center gap-3 sm:my-4">
              <div className="flex-1 border-t border-[#E8E3DD]" />
              <span className="text-xs text-[#ADA8A5]">
                {formatDateDivider(msgs[0].createdAt)}
              </span>
              <div className="flex-1 border-t border-[#E8E3DD]" />
            </div>

            {/* Messages for this day */}
            <div className="flex flex-col gap-1">
              {msgs.map((msg, idx) => {
                const isRecruiter = msg.senderRole === "recruiter";
                const isLastInGroup =
                  idx === msgs.length - 1 ||
                  msgs[idx + 1]?.senderRole !== msg.senderRole;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isRecruiter ? "justify-end" : "justify-start"}`}
                  >
                    {/* Athlete avatar — only on last in group */}
                    {!isRecruiter && (
                      <div className="mr-1.5 flex-shrink-0 self-end sm:mr-2">
                        {isLastInGroup ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EDEAE5] text-[10px] font-bold text-[#6B6561] sm:h-7 sm:w-7 sm:text-xs">
                            {athleteInitials}
                          </div>
                        ) : (
                          <div className="h-6 w-6 sm:h-7 sm:w-7" />
                        )}
                      </div>
                    )}

                    {/* max-w wider on mobile (like WhatsApp ~78%), narrower on desktop */}
                    <div
                      className={`max-w-[78%] sm:max-w-[55%] ${
                        isRecruiter ? "items-end" : "items-start"
                      } flex flex-col`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 sm:rounded-xl sm:px-3 sm:py-1.5 ${
                          isRecruiter
                            ? "rounded-br-sm bg-[#1A1A1A] text-white"
                            : "rounded-bl-sm bg-white text-[#1A1A1A] shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-snug sm:text-xs">
                          {msg.content}
                        </p>
                      </div>

                      {/* Timestamp + read receipt — only on last in group */}
                      {isLastInGroup && (
                        <div
                          className={`mt-0.5 flex items-center gap-1 ${
                            isRecruiter ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <span className="text-[10px] text-[#ADA8A5]">
                            {formatTime(msg.createdAt)}
                          </span>
                          {isRecruiter &&
                            (msg.readAt ? (
                              <CheckCheck size={11} className="text-[#3B6FE8]" />
                            ) : (
                              <Check size={11} className="text-[#ADA8A5]" />
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

      {/* Input — safe area bottom for home indicator */}
      <div
        className="flex-shrink-0 border-t border-[#E8E3DD] bg-[#FAFAF9] px-3 py-2 sm:px-5 sm:py-4"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            style={{ maxHeight: "120px" }}
            className="flex-1 resize-none overflow-y-auto rounded-3xl border border-[#E8E3DD] bg-white px-4 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:border-[#ADA8A5] focus:outline-none"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-white transition-colors hover:bg-[#3B6FE8] active:bg-[#3B6FE8] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
