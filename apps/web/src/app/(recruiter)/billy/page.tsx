"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, ChevronRight, Menu } from "lucide-react";
import { useBilly, AthleteResult } from "@/hooks/useBilly";

const MOCK_RECRUITER_ID = "e0b6c0c8-2b27-4521-9b26-46ace16b4983";

const SUGGESTIONS = [
  "Find developmental OL prospects in Florida",
  "Show me dual-threat QBs with strong academics",
  "Transfer portal WRs with 4.4 speed or faster",
  "D1 safeties from the Southeast, class of 2026",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

// Renders **bold** markdown inline
function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[#1A1A1A]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-[#EDEAE5] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#ADA8A5]"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

function AthleteCard({
  athlete,
  onContactJerry,
}: {
  athlete: AthleteResult;
  onContactJerry: (athleteId: string, athleteName: string) => void;
}) {
  const initials = athlete.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const statParts = [
    athlete.gpa ? `${athlete.gpa.toFixed(1)} GPA` : null,
    athlete.leagueLevel ?? null,
    athlete.ncaaEligible ? "NCAA Eligible" : null,
  ].filter(Boolean);

  const meta = [athlete.position, athlete.sport]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="py-5 first:pt-3">
      <div className="flex items-start gap-4">
        {/* Avatar with status dot */}
        <div className="relative flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEAE5] text-sm font-bold text-[#6B6561]">
            {initials}
          </div>
          <span className="absolute bottom-0.5 left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F5F0EB] bg-[#E07B5D]" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + position/sport */}
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[17px] font-bold text-[#1A1A1A]">
              {athlete.fullName}
            </p>
            {meta && (
              <p className="text-sm text-[#ADA8A5]">{meta}</p>
            )}
          </div>

          {/* Stats row */}
          {statParts.length > 0 && (
            <p className="mt-0.5 text-sm text-[#ADA8A5]">
              {statParts.join(" · ")}
            </p>
          )}

          {/* Match description — amber */}
          {athlete.dossier?.recruiterPitch && (
            <p className="mt-2 text-sm leading-relaxed text-[#B45309]">
              {athlete.dossier.recruiterPitch}
            </p>
          )}

          {/* Action links */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <button className="font-medium text-[#3B6FE8] hover:underline">
              View Dossier ›
            </button>
            <span className="text-[#C4BDBA]">·</span>
            <button
              className="text-[#6B6561] transition-colors hover:text-[#1A1A1A]"
            >
              Add to Pipeline
            </button>
            <span className="text-[#C4BDBA]">·</span>
            <button
              onClick={() => onContactJerry(athlete.id, athlete.fullName)}
              className="text-[#6B6561] transition-colors hover:text-[#1A1A1A]"
            >
              Request Introduction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared input bar ─────────────────────────────────────────────────────────

function InputBar({
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  placeholder,
  hint,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  hint?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#EDEAE5]">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:outline-none"
      />
      <div className="flex items-center justify-between px-5 pb-4">
        {hint ? (
          <div className="flex items-center gap-2 text-xs text-[#ADA8A5]">
            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-[#C4BDBA] text-[10px] leading-none">
              ?
            </div>
            {hint}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ADA8A5] text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-40"
        >
          <ArrowUp size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BillyPage() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, status, isTyping, sendMessage, contactJerry, handleOption } =
    useBilly(MOCK_RECRUITER_ID);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || status !== "connected") return;
    sendMessage(input.trim());
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Empty state (no messages yet) ──────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col bg-[#F5F0EB]">
        {/* Top bar */}
        <div className="px-4 pt-3">
          <button className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-white/50">
            <Menu size={18} />
          </button>
        </div>

        {/* Centered content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-16">
          {/* Chat input */}
          <div className="w-full max-w-2xl">
            <InputBar
              value={input}
              onChange={setInput}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              disabled={status !== "connected"}
              placeholder="Mike, tell me what kind of athlete fits your program."
              hint="I'll help you find the right fit"
              inputRef={textareaRef}
            />
          </div>

          {/* Status card */}
          <div className="w-full max-w-2xl rounded-xl bg-[#EDEAE5] px-5 py-4 text-sm text-[#4B4745]">
            You currently have{" "}
            <strong className="font-semibold text-[#1A1A1A]">
              2 active recruiting conversations
            </strong>{" "}
            and{" "}
            <strong className="font-semibold text-[#1A1A1A]">
              3 athletes under evaluation
            </strong>
            .
          </div>

          {/* Suggested searches */}
          <div className="w-full max-w-2xl">
            <p className="mb-2 text-xs text-[#ADA8A5]">Start a new search</p>
            <div className="divide-y divide-[#E4DDD7]">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left text-sm text-[#4B4745] transition-colors hover:text-[#1A1A1A]"
                >
                  <ChevronRight size={14} className="flex-shrink-0 text-[#ADA8A5]" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat state (messages exist) ────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[#F5F0EB]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {/* User message */}
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-lg rounded-2xl bg-[#1A1A1A] px-4 py-3 text-white">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Assistant message */}
              {msg.role === "assistant" && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-2xl bg-[#EDEAE5] px-5 py-4">
                    <p className="text-sm leading-relaxed text-[#4B4745]">
                      <Bold text={msg.content} />
                    </p>
                    {msg.searchResults && msg.searchResults.length > 0 && (
                      <p className="mt-3 text-xs text-[#ADA8A5]">
                        Found {msg.searchResults.length} athletes matching your recruiting criteria
                      </p>
                    )}
                  </div>

                  {msg.options && msg.options.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOption(option)}
                          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                            option.action === "contact_athlete"
                              ? "border-[#3B6FE8] bg-[#EEF2FD] text-[#3B6FE8] hover:bg-[#3B6FE8] hover:text-white"
                              : "border-[#E4DDD7] bg-white text-[#4B4745] hover:bg-[#EDEAE5]"
                          }`}
                        >
                          {option.action === "contact_athlete" ? "💬 " : "🔍 "}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Athlete search results — vertical list */}
              {msg.searchResults && msg.searchResults.length > 0 && (
                <div className="divide-y divide-[#E4DDD7]">
                  {msg.searchResults.map((athlete) => (
                    <AthleteCard
                      key={athlete.id}
                      athlete={athlete}
                      onContactJerry={(id, name) => contactJerry(id, name)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6">
        <div className="mx-auto max-w-2xl">
          <InputBar
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            disabled={status !== "connected"}
            placeholder="Ask Billy anything about your search…"
          />
        </div>
      </div>
    </div>
  );
}
