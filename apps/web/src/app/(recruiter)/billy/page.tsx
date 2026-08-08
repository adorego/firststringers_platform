"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createBillyConversation, BILLY_SUGGESTIONS } from "@/hooks/useBilly";
import { RecruiterOnboardingForm } from "@/components/recruiter/RecruiterOnboardingForm";
import { api } from "@/lib/api";

export default function BillyLandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const recruiterId = session?.user?.recruiterId ?? "e0b6c0c8-2b27-4521-9b26-46ace16b4983";

  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Flips true the instant the user sends their first message, so the input
  // starts animating down to the bottom right away — no waiting on the network
  // round-trip before the "Claude-style" transition begins.
  const [activating, setActivating] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);
  const redirectedRef = useRef(false);

  const startConversation = async (initialMessage?: string) => {
    if (isCreating || redirectedRef.current) return;
    setIsCreating(true);
    if (initialMessage) {
      setPendingMessage(initialMessage);
      setActivating(true);
    }
    try {
      const conv = await createBillyConversation(recruiterId);
      if (!conv) {
        setActivating(false);
        setPendingMessage(null);
        return;
      }
      router.push(
        `/billy/${conv.id}${initialMessage ? `?q=${encodeURIComponent(initialMessage)}` : ""}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Previous chat-based onboarding (kept for easy revert) ───────────────
  // Onboarding used to start automatically as soon as the recruiter account was
  // created — jumping straight into a Billy conversation so the chat-based
  // onboarding could kick in. Replaced by the short mini-form below; uncomment
  // this (and remove the effect after it) to go back to the chat flow.
  // useEffect(() => {
  //   if (!session) return;
  //   api
  //     .getRecruiterProfile()
  //     .then(async (profile) => {
  //       if (!profile.onboardingCompleted && !redirectedRef.current) {
  //         redirectedRef.current = true;
  //         const conv = await createBillyConversation(recruiterId);
  //         if (conv) {
  //           router.replace(`/billy/${conv.id}`);
  //           return;
  //         }
  //       }
  //       setReady(true);
  //     })
  //     .catch(() => setReady(true));
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [session]);

  // Recruiter account just created — check whether the short onboarding form
  // still needs to be filled out before showing the normal Billy landing page.
  useEffect(() => {
    if (!session) return;
    api
      .getRecruiterProfile()
      .then((profile) => {
        setOnboardingIncomplete(!profile.onboardingCompleted);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [session]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg) return;
    startConversation(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F5F0]">
        <svg className="h-5 w-5 animate-spin text-[#ADA8A5]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (onboardingIncomplete) {
    return (
      <RecruiterOnboardingForm
        recruiterName={session?.user?.name || "Coach"}
        onComplete={() => setOnboardingIncomplete(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#F5F5F0] px-8">
      {/* Top spacer — collapses as the input drops toward the bottom */}
      <div
        className="transition-[flex-grow] duration-500 ease-out"
        style={{ flexGrow: activating ? 0 : 1 }}
      />

      {/* The just-sent message, previewed here so there's no visual jump when
          we hand off to /billy/[id], which renders the same bubble via useBilly. */}
      <div
        className="overflow-hidden transition-[flex-grow] duration-500 ease-out"
        style={{ flexGrow: activating ? 1 : 0 }}
      >
        {pendingMessage && (
          <div className="mx-auto flex max-w-2xl justify-end py-6">
            <div className="max-w-lg rounded-2xl bg-[#1A1A1A] px-4 py-3 text-white">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{pendingMessage}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-5 pb-6">
        {/* Input */}
        <div className="overflow-hidden rounded-2xl bg-[#EDEAE5]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${session?.user?.name || "Coach"}, tell me what kind of athlete fits your program…`}
            rows={3}
            disabled={activating}
            className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between px-5 pb-4">
            <div className="flex items-center gap-2 text-xs text-[#ADA8A5]">
              <div className="flex h-4 w-4 items-center justify-center rounded-full border border-[#C4BDBA] text-[10px] leading-none">
                ?
              </div>
              I&apos;ll help you find the right fit
            </div>
            <button
              onClick={handleSend}
              disabled={isCreating || !input.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ADA8A5] text-white transition-colors hover:bg-[#1A1A1A] disabled:opacity-40"
            >
              <ArrowUp size={13} />
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {!activating && (
          <div>
            <p className="mb-2 text-xs text-[#ADA8A5]">Start a new search</p>
            <div className="divide-y divide-[#E4DDD7]">
              {BILLY_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => startConversation(s)}
                  disabled={isCreating}
                  className="flex w-full items-center gap-3 py-3 text-left text-sm text-[#4B4745] transition-colors hover:text-[#1A1A1A] disabled:opacity-50"
                >
                  <ChevronRight size={14} className="flex-shrink-0 text-[#ADA8A5]" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom spacer — collapses as the input drops toward the bottom */}
      <div
        className="transition-[flex-grow] duration-500 ease-out"
        style={{ flexGrow: activating ? 0 : 1 }}
      />
    </div>
  );
}
