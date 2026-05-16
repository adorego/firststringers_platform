"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wifi, WifiOff, ChevronDown, User, GraduationCap, MapPin } from "lucide-react";
import { useBilly, AthleteResult, SearchCriteria } from "@/hooks/useBilly";

// ─── Temporary: replace with real auth when ready ───────────────────────────
const MOCK_RECRUITER_ID = "recruiter-dev-001";

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: "connecting" | "connected" | "disconnected" | "error" }) {
  const colors = {
    connecting: "bg-yellow-400 animate-pulse",
    connected: "bg-fs-green",
    disconnected: "bg-gray-400",
    error: "bg-red-500",
  };
  const labels = {
    connecting: "Connecting…",
    connected: "Online",
    disconnected: "Offline",
    error: "Error",
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      <span className="text-xs text-fs-muted">{labels[status]}</span>
    </div>
  );
}

function CriteriaPanel({ criteria }: { criteria: SearchCriteria }) {
  const entries = Object.entries(criteria).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  });

  if (entries.length === 0) return null;

  const label: Record<string, string> = {
    sport: "Sport",
    position: "Position",
    leagueLevel: "Division",
    minGpa: "Min GPA",
    ncaaEligible: "NCAA Eligible",
    inTransferPortal: "Transfer Portal",
    preferredRegions: "Regions",
    graduationYear: "Grad Year",
    keyStrengths: "Strengths",
  };

  return (
    <div className="border-b border-fs-border-gray bg-white px-6 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fs-muted">
        Search Criteria
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="rounded-full border border-fs-border-gray bg-fs-light-gray px-3 py-1 text-xs font-medium text-[#111827]"
          >
            <span className="text-fs-muted">{label[key] ?? key}: </span>
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function AthleteCard({ athlete }: { athlete: AthleteResult }) {
  return (
    <div className="rounded-xl border border-fs-border-gray bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fs-light-gray text-sm font-bold text-[#111827]">
            {athlete.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-[#111827]">{athlete.fullName}</p>
            <p className="text-xs text-fs-muted">
              {athlete.position} · {athlete.sport}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-fs-light-gray px-2 py-1 text-xs font-medium text-[#111827]">
          {Math.round(athlete.completenessScore)}% complete
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-fs-muted">
        {athlete.leagueLevel && (
          <span className="flex items-center gap-1">
            <User size={11} /> {athlete.leagueLevel}
          </span>
        )}
        {athlete.gpa && (
          <span className="flex items-center gap-1">
            <GraduationCap size={11} /> GPA {athlete.gpa.toFixed(1)}
          </span>
        )}
        {athlete.ncaaEligible && (
          <span className="flex items-center gap-1 text-fs-green">
            ✓ NCAA Eligible
          </span>
        )}
      </div>

      {athlete.dossier?.recruiterPitch && (
        <p className="mt-2 text-xs leading-relaxed text-[#374151] line-clamp-2">
          {athlete.dossier.recruiterPitch}
        </p>
      )}

      <button className="mt-3 w-full rounded-lg border border-fs-border-gray py-1.5 text-xs font-medium text-[#111827] transition-colors hover:bg-fs-light-gray">
        View Profile
      </button>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-fs-light-gray px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BillyPage() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, status, isTyping, searchCriteria, sendMessage } =
    useBilly(MOCK_RECRUITER_ID);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || status !== "connected") return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-fs-border-gray bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827] text-xs font-black text-white">
            B
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">Billy</h1>
            <StatusDot status={status} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-fs-muted">
          {status === "connected" ? (
            <Wifi size={14} className="text-fs-green" />
          ) : (
            <WifiOff size={14} />
          )}
          Recruiting Intelligence
        </div>
      </header>

      {/* Criteria strip */}
      <CriteriaPanel criteria={searchCriteria} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#111827] text-xs font-black text-white">
                    B
                  </div>
                )}
                <div
                  className={`max-w-lg rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-[#111827] text-white"
                      : "bg-fs-light-gray text-[#111827]"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      msg.role === "user" ? "text-white/40" : "text-fs-muted"
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {/* Search results inline */}
              {msg.searchResults && msg.searchResults.length > 0 && (
                <div className="mt-4 ml-9">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fs-muted">
                    {msg.searchResults.length} Athletes Found
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {msg.searchResults.map((athlete) => (
                      <AthleteCard key={athlete.id} athlete={athlete} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-fs-border-gray bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === "connected"
                  ? "Ask Billy anything about your search…"
                  : "Connecting…"
              }
              disabled={status !== "connected"}
              className="h-12 w-full rounded-full border border-fs-border-gray bg-white pl-5 pr-5 text-sm text-[#111827] placeholder:text-fs-muted focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || status !== "connected"}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#111827] text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40"
          >
            {isTyping ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-fs-muted">
          Billy uses AI to refine your search and surface the best athlete matches.
        </p>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}