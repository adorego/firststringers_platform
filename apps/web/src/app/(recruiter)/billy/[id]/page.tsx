"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBilly, AthleteResult } from "@/hooks/useBilly";
import { DossierPanel } from "@/components/recruiter/DossierPanel";
import { api } from "@/lib/api";

// ─── Sub-components ──────────────────────────────────────────────────────────

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
  onViewDossier,
  onRequestIntro,
  onAddToPipeline,
  isInPipeline,
}: {
  athlete: AthleteResult;
  onViewDossier: (athlete: AthleteResult) => void;
  onRequestIntro: (athlete: AthleteResult) => void;
  onAddToPipeline: (athlete: AthleteResult) => void;
  isInPipeline: boolean;
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

  const meta = [athlete.position, athlete.sport].filter(Boolean).join(" · ");

  return (
    <div className="py-5 first:pt-3">
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEAE5] text-sm font-bold text-[#6B6561]">
            {initials}
          </div>
          <span className="absolute bottom-0.5 left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F5F0EB] bg-[#E07B5D]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[17px] font-bold text-[#1A1A1A]">{athlete.fullName}</p>
            {meta && <p className="text-sm text-[#ADA8A5]">{meta}</p>}
          </div>

          {statParts.length > 0 && (
            <p className="mt-0.5 text-sm text-[#ADA8A5]">{statParts.join(" · ")}</p>
          )}

          {athlete.dossier?.recruiterPitch && (
            <p className="mt-2 text-sm leading-relaxed text-[#B45309]">
              {athlete.dossier.recruiterPitch}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <button
              onClick={() => onViewDossier(athlete)}
              className="font-medium text-[#3B6FE8] hover:underline"
            >
              View Dossier ›
            </button>
            <span className="text-[#C4BDBA]">·</span>
            <button
              onClick={() => onAddToPipeline(athlete)}
              disabled={isInPipeline}
              className="text-[#6B6561] transition-colors hover:text-[#1A1A1A] disabled:text-[#2E7D32]"
            >
              {isInPipeline ? "Added ✓" : "Add to Pipeline"}
            </button>
            <span className="text-[#C4BDBA]">·</span>
            <button
              onClick={() => onRequestIntro(athlete)}
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

function InputBar({
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  disabled: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#EDEAE5]">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask Billy anything about your search…"
        rows={3}
        className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:outline-none"
      />
      <div className="flex items-center justify-end px-5 pb-4">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillyChatPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q");
  const { data: session } = useSession();
  const recruiterId = session?.user?.recruiterId ?? "e0b6c0c8-2b27-4521-9b26-46ace16b4983";

  const [input, setInput] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteResult | null>(null);
  const [openToIntro, setOpenToIntro] = useState(false);
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  const handleAddToPipeline = async (athlete: AthleteResult) => {
    if (pipelineIds.has(athlete.id)) return;
    setPipelineIds((prev) => new Set(prev).add(athlete.id));
    try {
      await api.addToPipeline(athlete.id);
    } catch {
      setPipelineIds((prev) => {
        const next = new Set(prev);
        next.delete(athlete.id);
        return next;
      });
    }
  };

  const { messages, status, isTyping, suggestedSearches, redirectTo, sendMessage, handleOption } =
    useBilly(recruiterId, conversationId);

  // Auto-send the suggestion from the landing page once connected
  useEffect(() => {
    if (initialQuery && status === "connected" && !autoSentRef.current) {
      autoSentRef.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, status, sendMessage]);

  // Onboarding just wrapped up in this conversation — hand off to the fresh
  // chat Billy opened with suggestions, after giving time to read the closing message.
  useEffect(() => {
    if (!redirectTo) return;
    const timer = setTimeout(() => router.push(`/billy/${redirectTo}`), 2500);
    return () => clearTimeout(timer);
  }, [redirectTo, router]);

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

  return (
    <>
      <div className="flex h-full flex-col bg-[#F5F0EB]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" && (
                  <div className="flex justify-end">
                    <div className="max-w-lg rounded-2xl bg-[#1A1A1A] px-4 py-3 text-white">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {msg.role === "assistant" && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-2xl bg-[#EDEAE5] px-5 py-4">
                      <p className="text-sm leading-relaxed text-[#4B4745]">
                        <Bold text={msg.content} />
                      </p>
                      {msg.searchResults && msg.searchResults.length > 0 && (
                        <p className="mt-3 text-xs text-[#ADA8A5]">
                          Found {msg.searchResults.length} athletes matching your recruiting
                          criteria
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

                {msg.searchResults && msg.searchResults.length > 0 && (
                  <div className="divide-y divide-[#E4DDD7]">
                    {msg.searchResults.map((athlete) => (
                      <AthleteCard
                        key={athlete.id}
                        athlete={athlete}
                        onViewDossier={(a) => {
                          setOpenToIntro(false);
                          setSelectedAthlete(a);
                        }}
                        onRequestIntro={(a) => {
                          setOpenToIntro(true);
                          setSelectedAthlete(a);
                        }}
                        onAddToPipeline={handleAddToPipeline}
                        isInPipeline={pipelineIds.has(athlete.id)}
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

        {/* Suggested searches — appear once after onboarding completes */}
        {suggestedSearches.length > 0 && (
          <div className="px-6 pb-2">
            <div className="mx-auto max-w-2xl">
              <p className="mb-2 text-xs text-[#ADA8A5]">Suggested searches</p>
              <div className="flex flex-wrap gap-2">
                {suggestedSearches.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="rounded-full border border-[#E4DDD7] bg-white px-4 py-1.5 text-xs text-[#4B4745] transition-colors hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-6 pb-6">
          <div className="mx-auto max-w-2xl">
            <InputBar
              value={input}
              onChange={setInput}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              disabled={status !== "connected"}
              inputRef={textareaRef}
            />
          </div>
        </div>
      </div>

      <DossierPanel
        athlete={selectedAthlete}
        openToIntro={openToIntro}
        onClose={() => {
          setSelectedAthlete(null);
          setOpenToIntro(false);
        }}
        onAddToPipeline={handleAddToPipeline}
        isInPipeline={selectedAthlete ? pipelineIds.has(selectedAthlete.id) : false}
      />
    </>
  );
}
