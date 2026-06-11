"use client";

import { useState } from "react";
import { ChevronRight, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createBillyConversation } from "@/hooks/useBilly";

const SUGGESTIONS = [
  "Find developmental OL prospects in Florida",
  "Show me dual-threat QBs with strong academics",
  "Transfer portal WRs with 4.4 speed or faster",
  "D1 safeties from the Southeast, class of 2026",
];

export default function BillyLandingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const recruiterId = session?.user?.recruiterId ?? "e0b6c0c8-2b27-4521-9b26-46ace16b4983";
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const startConversation = async (initialMessage?: string) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const conv = await createBillyConversation(recruiterId);
      if (!conv) return;
      router.push(`/billy/${conv.id}${initialMessage ? `?q=${encodeURIComponent(initialMessage)}` : ""}`);
    } finally {
      setIsCreating(false);
    }
  };

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

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F5F0EB] px-8 pb-16">
      <div className="w-full max-w-2xl space-y-5">
        {/* Input */}
        <div className="overflow-hidden rounded-2xl bg-[#EDEAE5]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${session?.user?.name || "Recruiter"}, tell me what kind of athlete fits your program.`}
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-sm text-[#1A1A1A] placeholder:text-[#ADA8A5] focus:outline-none"
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
        <div>
          <p className="mb-2 text-xs text-[#ADA8A5]">Start a new search</p>
          <div className="divide-y divide-[#E4DDD7]">
            {SUGGESTIONS.map((s, i) => (
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
      </div>
    </div>
  );
}
