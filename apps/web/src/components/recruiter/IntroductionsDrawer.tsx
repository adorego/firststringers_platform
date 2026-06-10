"use client";

import { X, Zap } from "lucide-react";
import { AthleteResult } from "@/hooks/useBilly";

interface IntroAthlete {
  id: string;
  name: string;
  position: string;
  classYear: number;
  location: string;
  fortyTime?: string;
  height?: string;
  gpa?: number;
  school?: string;
  jerryPitch: string;
  surfacedAt: string;
}

const MOCK_INTROS: IntroAthlete[] = [
  {
    id: "intro-1",
    name: "Marcus Chen",
    position: "CB",
    classYear: 2027,
    location: "Austin, TX",
    fortyTime: "4.45",
    height: "6'0\"",
    gpa: 3.6,
    school: "Westlake HS",
    jerryPitch:
      "Jerry believes Marcus may strongly align with your preference for developmental defensive backs with elite recovery speed and academic consistency.",
    surfacedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "intro-2",
    name: "Isaiah Thompson",
    position: "TE",
    classYear: 2026,
    location: "Concord, CA",
    fortyTime: "4.72",
    height: "6'4\"",
    gpa: 3.8,
    school: "De La Salle HS",
    jerryPitch:
      "Jerry surfaced Isaiah based on your recent focus on athletic tight ends with high-point catching ability and long-term developmental fit.",
    surfacedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "intro-3",
    name: "Devon Reyes",
    position: "WR",
    classYear: 2026,
    location: "Miami, FL",
    fortyTime: "4.38",
    height: "5'11\"",
    gpa: 3.2,
    school: "Miami Northwestern",
    jerryPitch:
      "Devon's route-running precision and separation speed closely match the profile you searched for last week. His 4.38 forty places him in the top 5% of WR prospects nationally.",
    surfacedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "intro-4",
    name: "Caleb Morrison",
    position: "OT",
    classYear: 2027,
    location: "Houston, TX",
    height: "6'6\"",
    gpa: 3.0,
    school: "Katy HS",
    jerryPitch:
      "Jerry flagged Caleb as an emerging developmental lineman with exceptional length and footwork for his class. Fits your stated interest in early-cycle OL prospects.",
    surfacedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface IntroductionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDossier?: (athlete: AthleteResult) => void;
}

function toAthleteResult(a: IntroAthlete): AthleteResult {
  return {
    id: a.id,
    fullName: a.name,
    sport: "Football",
    position: a.position,
    gpa: a.gpa,
    ncaaEligible: false,
    completenessScore: 0.75,
    dossier: { recruiterPitch: a.jerryPitch },
  };
}

export function IntroductionsDrawer({ isOpen, onClose, onViewDossier }: IntroductionsDrawerProps) {
  const athletes = MOCK_INTROS;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[560px] max-w-[90vw] flex-col bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E8E3DD] px-7 py-6">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Introductions</h2>
              <span className="text-sm text-[#ADA8A5]">{athletes.length} pending</span>
            </div>
            <p className="mt-0.5 text-sm text-[#ADA8A5]">
              Athletes Jerry has surfaced for you
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E8E3DD] px-7">
          {athletes.map((athlete) => {
            const initials = athlete.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2);

            const statParts = [
              athlete.fortyTime ? `${athlete.fortyTime} 40` : null,
              athlete.height ?? null,
              athlete.gpa ? `${athlete.gpa.toFixed(1)} GPA` : null,
              athlete.school ?? null,
            ].filter(Boolean);

            return (
              <div key={athlete.id} className="py-6">
                {/* Name row */}
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-sm font-bold text-[#6B6561]">
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[17px] font-bold text-[#1A1A1A]">{athlete.name}</p>
                      <p className="text-sm text-[#ADA8A5]">
                        {athlete.position} · {athlete.classYear} · {athlete.location}
                      </p>
                    </div>

                    {statParts.length > 0 && (
                      <p className="mt-0.5 text-sm text-[#ADA8A5]">
                        {statParts.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Jerry pitch card */}
                <div className="mt-4 flex gap-3 rounded-xl bg-[#F0EDE9] px-4 py-3.5">
                  <Zap size={14} className="mt-0.5 flex-shrink-0 text-[#ADA8A5]" />
                  <p className="text-sm leading-relaxed text-[#4B4745]">
                    {athlete.jerryPitch}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <button
                    onClick={() => onViewDossier?.(toAthleteResult(athlete))}
                    className="font-medium text-[#3B6FE8] hover:underline"
                  >
                    View Dossier ›
                  </button>
                  <span className="text-[#C4BDBA]">·</span>
                  <button className="text-[#6B6561] transition-colors hover:text-[#1A1A1A]">
                    Add to Pipeline
                  </button>
                  <span className="text-[#C4BDBA]">·</span>
                  <button className="text-[#6B6561] transition-colors hover:text-[#1A1A1A]">
                    Request Introduction
                  </button>
                </div>

                {/* Surfaced timestamp */}
                <p className="mt-2 text-xs text-[#ADA8A5]">
                  Surfaced {timeAgo(athlete.surfacedAt)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="border-t border-[#E8E3DD] px-7 py-5">
          <div className="flex items-start gap-3 rounded-xl bg-[#F0EDE9] px-4 py-4">
            <Zap size={16} className="mt-0.5 flex-shrink-0 text-[#ADA8A5]" />
            <p className="text-sm leading-relaxed text-[#4B4745]">
              Jerry continuously monitors athlete profiles and surfaces prospects
              that match your recruiting preferences and program needs.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
