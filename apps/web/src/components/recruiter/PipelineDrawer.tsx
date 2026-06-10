"use client";

import { X, TrendingUp } from "lucide-react";

interface PipelineAthlete {
  id: string;
  name: string;
  position: string;
  graduationYear: number;
  school: string;
  pitch: string;
  lastUpdate: {
    type: string;
    timeAgo: string;
    description: string;
  };
}

const MOCK_PIPELINE: PipelineAthlete[] = [
  {
    id: "1",
    name: "Diego Martinez",
    position: "WR",
    graduationYear: 2027,
    school: "Coral Gables HS",
    pitch: "Elite speed with polished route running. Developmental upside is high.",
    lastUpdate: {
      type: "PROFILE UPDATE",
      timeAgo: "2 DAYS AGO",
      description: "Updated height/weight measurements added",
    },
  },
  {
    id: "2",
    name: "Jaylen Brooks",
    position: "WR",
    graduationYear: 2027,
    school: "Edgewater HS",
    pitch: "Undervalued with exceptional YAC ability. Strong academic profile.",
    lastUpdate: {
      type: "ACADEMIC UPDATE",
      timeAgo: "1 WEEK AGO",
      description: "GPA updated to 3.7",
    },
  },
  {
    id: "3",
    name: "Marcus Williams",
    position: "QB",
    graduationYear: 2026,
    school: "Liberty HS",
    pitch: "Dual-threat QB with strong arm. Excels under pressure in two-minute drills.",
    lastUpdate: {
      type: "VIDEO UPDATE",
      timeAgo: "3 DAYS AGO",
      description: "New game film from state playoffs uploaded",
    },
  },
];

interface PipelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PipelineDrawer({ isOpen, onClose }: PipelineDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-[520px] max-w-[90vw] overflow-y-auto bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E3DD] px-7 py-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Pipeline</h2>
              <span className="text-sm text-[#ADA8A5]">
                {MOCK_PIPELINE.length} evaluating
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#ADA8A5]">
              Athletes you&apos;re actively evaluating
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Athlete list */}
        <div className="divide-y divide-[#E8E3DD]">
          {MOCK_PIPELINE.map((athlete) => {
            const initials = athlete.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2);

            return (
              <div key={athlete.id} className="px-7 py-6">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-base font-bold text-[#6B6561]">
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold text-[#1A1A1A]">
                      {athlete.name}
                    </p>
                    <p className="text-sm text-[#ADA8A5]">
                      {athlete.position} · {athlete.graduationYear} · {athlete.school}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[#4B4745]">
                      {athlete.pitch}
                    </p>
                  </div>
                </div>

                {/* Last update card */}
                <div className="mt-4 rounded-xl bg-[#F0EDE9] px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <TrendingUp size={13} className="text-[#ADA8A5]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#ADA8A5]">
                      {athlete.lastUpdate.type} · {athlete.lastUpdate.timeAgo}
                    </span>
                  </div>
                  <p className="text-sm text-[#4B4745]">
                    {athlete.lastUpdate.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
