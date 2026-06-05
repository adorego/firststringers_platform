"use client";

import { useState, useEffect } from "react";
import { X, MapPin, TrendingUp, ArrowLeft, CheckCircle } from "lucide-react";
import { AthleteResult } from "@/hooks/useBilly";

interface ProfileUpdate {
  title: string;
  detail: string;
}

// Mock profile updates — will come from backend when dossier history is implemented
const MOCK_UPDATES: Record<string, ProfileUpdate[]> = {};

function getMockUpdates(athleteId: string): ProfileUpdate[] {
  if (MOCK_UPDATES[athleteId]) return MOCK_UPDATES[athleteId];
  // Generic fallback updates
  return [
    {
      title: "Updated measurements",
      detail: "Height: 6'1\" → 6'2.5\" · Weight: 185 → 192 lbs",
    },
    {
      title: "New footage added",
      detail: "2025 Spring Camp highlights (3:45) uploaded 4 days ago",
    },
  ];
}

function getProspectTag(score: number): { label: string; color: string; bg: string } | null {
  if (score >= 0.85) return { label: "Hot Prospect", color: "#C0392B", bg: "#FDECEA" };
  if (score >= 0.65) return { label: "Rising Prospect", color: "#D97706", bg: "#FEF3C7" };
  if (score >= 0.45) return { label: "Developmental", color: "#2563EB", bg: "#EFF6FF" };
  return null;
}

interface DossierPanelProps {
  athlete: AthleteResult | null;
  onClose: () => void;
  onAddToPipeline?: (athlete: AthleteResult) => void;
  onRequestIntro?: (athlete: AthleteResult) => void;
  openToIntro?: boolean;
}

// Mock recruiter profile — will come from auth context when backend is wired
const MOCK_RECRUITER = {
  name: "Mike Thompson",
  title: "Head Coach",
  school: "State University",
  pitch:
    "We've reviewed your film and metrics and believe you'd be a strong fit for our program. We run a spread RPO system built for athletes with your profile, and we'd love to connect to share what we can offer you — both on the field and academically.",
};

type IntroState = "idle" | "confirming" | "sent";

export function DossierPanel({
  athlete,
  onClose,
  onAddToPipeline,
  onRequestIntro,
  openToIntro = false,
}: DossierPanelProps) {
  const [introState, setIntroState] = useState<IntroState>("idle");

  useEffect(() => {
    setIntroState(openToIntro ? "confirming" : "idle");
  }, [athlete?.id]);
  const isOpen = athlete !== null;

  // Reset intro flow whenever the panel opens a new athlete or closes
  const handleClose = () => {
    setIntroState("idle");
    onClose();
  };

  if (!athlete) {
    return (
      <div className="fixed right-0 top-0 z-50 h-full w-[560px] max-w-[90vw] translate-x-full bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out" />
    );
  }

  const initials = athlete.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const tag = getProspectTag(athlete.completenessScore);
  const updates = getMockUpdates(athlete.id);

  const metaLine = [
    athlete.position,
    athlete.sport,
    athlete.leagueLevel,
  ]
    .filter(Boolean)
    .join(" · ");

  const panelClass = `fixed right-0 top-0 z-50 h-full w-[560px] max-w-[90vw] overflow-y-auto bg-[#FAFAF9] shadow-2xl transition-transform duration-300 ease-in-out ${
    isOpen ? "translate-x-0" : "translate-x-full"
  }`;

  const backdropClass = `fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${
    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
  }`;

  if (introState === "confirming") {
    return (
      <>
        <div className={backdropClass} onClick={handleClose} />
        <div className={panelClass}>
          <div className="flex h-full flex-col px-8 py-8">
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setIntroState("idle")}
                className="rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
              >
                <ArrowLeft size={18} />
              </button>
              <p className="text-base font-semibold text-[#1A1A1A]">Request Introduction</p>
            </div>

            <p className="mb-4 text-sm text-[#6B6561]">
              This is what{" "}
              <span className="font-semibold text-[#1A1A1A]">{athlete.fullName}</span>{" "}
              will see:
            </p>

            <div className="rounded-2xl border border-[#E8E3DD] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#3B6FE8] text-sm font-bold text-white">
                  MT
                </div>
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{MOCK_RECRUITER.name}</p>
                  <p className="text-xs text-[#ADA8A5]">
                    {MOCK_RECRUITER.title} · {MOCK_RECRUITER.school}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[#4B4745]">{MOCK_RECRUITER.pitch}</p>
            </div>

            <div className="mt-auto flex gap-3 pt-6">
              <button
                onClick={() => setIntroState("idle")}
                className="flex-1 rounded-xl border border-[#E8E3DD] py-2.5 text-sm font-medium text-[#6B6561] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onRequestIntro?.(athlete);
                  setIntroState("sent");
                }}
                className="flex-1 rounded-xl bg-[#1A1A1A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3B6FE8]"
              >
                Confirm &amp; Send
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (introState === "sent") {
    return (
      <>
        <div className={backdropClass} onClick={handleClose} />
        <div className={panelClass}>
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <CheckCircle size={48} className="text-[#3B6FE8]" strokeWidth={1.5} />
            <p className="text-lg font-semibold text-[#1A1A1A]">Request sent successfully.</p>
            <p className="max-w-[280px] text-sm leading-relaxed text-[#6B6561]">
              Once{" "}
              <span className="font-semibold text-[#1A1A1A]">{athlete.fullName}</span>{" "}
              accepts, they will appear in your Connections.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 rounded-xl bg-[#1A1A1A] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3B6FE8]"
            >
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={panelClass}>
        <div className="flex items-start gap-5 px-8 pt-8 pb-6">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-xl font-bold text-[#6B6561]">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-[#1A1A1A]">{athlete.fullName}</p>
            <p className="mt-0.5 text-sm text-[#ADA8A5]">{metaLine}</p>
            {athlete.gpa && (
              <p className="text-sm text-[#ADA8A5]">
                {athlete.ncaaEligible ? "NCAA Eligible · " : ""}GPA {athlete.gpa.toFixed(1)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {tag && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ color: tag.color, backgroundColor: tag.bg }}
                >
                  {tag.label}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-[#ADA8A5]">
                <MapPin size={11} />
                Miami, FL
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-[#ADA8A5] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-6 px-8 pb-8">
          {athlete.dossier?.recruiterPitch && (
            <p className="text-sm leading-relaxed text-[#4B4745]">
              {athlete.dossier.recruiterPitch}
            </p>
          )}

          <div className="flex items-center gap-4 border-y border-[#E8E3DD] py-4">
            <button
              onClick={() => onAddToPipeline?.(athlete)}
              className="flex-1 rounded-xl border border-[#E8E3DD] py-2.5 text-sm font-medium text-[#6B6561] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
            >
              Add to Pipeline
            </button>
            <button
              onClick={() => setIntroState("confirming")}
              className="flex-1 rounded-xl bg-[#1A1A1A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3B6FE8]"
            >
              Request Introduction
            </button>
          </div>

          <div className="rounded-xl bg-[#F0EDE9] px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={13} className="text-[#ADA8A5]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#ADA8A5]">
                Profile Updates
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {updates.map((u, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{u.title}</p>
                  <p className="text-sm text-[#ADA8A5]">{u.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {athlete.dossier?.summary && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#ADA8A5]">
                Scouting Report
              </p>
              <p className="text-sm leading-relaxed text-[#4B4745]">{athlete.dossier.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {athlete.gpa && (
              <div className="rounded-xl bg-[#F0EDE9] px-4 py-3">
                <p className="text-xs text-[#ADA8A5]">GPA</p>
                <p className="text-lg font-bold text-[#1A1A1A]">{athlete.gpa.toFixed(1)}</p>
              </div>
            )}
            <div className="rounded-xl bg-[#F0EDE9] px-4 py-3">
              <p className="text-xs text-[#ADA8A5]">Profile</p>
              <p className="text-lg font-bold text-[#1A1A1A]">
                {Math.round(athlete.completenessScore * 100)}%
              </p>
            </div>
            {athlete.leagueLevel && (
              <div className="rounded-xl bg-[#F0EDE9] px-4 py-3">
                <p className="text-xs text-[#ADA8A5]">Division</p>
                <p className="text-lg font-bold text-[#1A1A1A]">{athlete.leagueLevel}</p>
              </div>
            )}
            {athlete.ncaaEligible && (
              <div className="rounded-xl bg-[#F0EDE9] px-4 py-3">
                <p className="text-xs text-[#ADA8A5]">NCAA</p>
                <p className="text-lg font-bold text-[#3B6FE8]">Eligible</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
