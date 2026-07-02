"use client";

import { X, MessageSquare, Search, Users, Zap } from "lucide-react";

interface LearnBillyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    icon: <MessageSquare size={18} className="text-[#3B6FE8]" />,
    title: "Talk to Billy naturally",
    body: "Billy understands plain English. Just tell him what you need — sport, position, academic requirements, region — and he'll ask follow-up questions to narrow it down.",
    example: '"Find me a dual-threat QB with a 3.5+ GPA from the Southeast."',
  },
  {
    icon: <Search size={18} className="text-[#3B6FE8]" />,
    title: "Refine your search",
    body: "Billy builds a profile of your ideal recruit through conversation. Each answer you give sharpens the results. You can change criteria at any time just by asking.",
    example: '"Actually, make it transfer-portal only and bump the GPA to 3.8."',
  },
  {
    icon: <Users size={18} className="text-[#3B6FE8]" />,
    title: "Explore athlete profiles",
    body: 'When Billy finds matches, click "View Dossier" on any athlete to see their full profile — academic record, athletic history, and Billy\'s personalized pitch for why they\'re a fit.',
    example: null,
  },
  {
    icon: <Zap size={18} className="text-[#3B6FE8]" />,
    title: "Request introductions",
    body: 'Use "Request Introduction" on any athlete card. Billy coordinates with Jerry — the athlete\'s AI — to make a warm introduction, so your first message always lands in context.',
    example: null,
  },
];

export function LearnBillyPanel({ isOpen, onClose }: LearnBillyPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-[90vw] flex-col bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E3DD] px-7 py-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B6FE8] text-xs font-black text-white">
                B
              </div>
              <h2 className="text-xl font-bold text-[#1A1A1A]">Learn Billy</h2>
            </div>
            <p className="mt-1 text-sm text-[#ADA8A5]">Your recruiting intelligence agent</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {/* What is Billy */}
          <div className="mb-6 rounded-xl bg-[#EEF2FD] px-5 py-4">
            <p className="text-sm leading-relaxed text-[#3B6FE8]">
              <strong className="font-semibold">Billy</strong> is an AI agent that helps you
              discover and recruit the right athletes through natural conversation. He replaces
              manual search filters with an intelligent dialogue that understands your program&apos;s
              real needs.
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="mb-2 flex items-center gap-2.5">
                  {section.icon}
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">{section.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-[#4B4745]">{section.body}</p>
                {section.example && (
                  <div className="mt-2.5 rounded-lg bg-[#F5F0EB] px-3.5 py-2.5">
                    <p className="font-mono text-xs italic text-[#6B6561]">{section.example}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-8 rounded-xl border border-[#E4DDD7] px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#ADA8A5]">
              Tips
            </p>
            <ul className="space-y-2 text-sm text-[#4B4745]">
              {[
                "Start with sport and position — Billy needs these first.",
                "Every conversation is saved. Return to any search from the sidebar.",
                "You can have multiple searches running at once.",
                'Billy remembers context within a conversation, so you can say "change the GPA" without repeating yourself.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#ADA8A5]" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-[#E8E3DD] px-7 py-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-[#3B6FE8] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2F5DD4]"
          >
            Start a New Search
          </button>
        </div>
      </div>
    </>
  );
}
