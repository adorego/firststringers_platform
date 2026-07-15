"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { X, MapPin, ArrowLeft, CheckCircle } from "lucide-react";
import { AthleteResult } from "@/hooks/useBilly";

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
  onRequestIntro?: (athlete: AthleteResult) => Promise<boolean> | void;
  openToIntro?: boolean;
  isInPipeline?: boolean;
}

type IntroState = "idle" | "confirming" | "sending" | "sent" | "error";

export function DossierPanel({
  athlete,
  onClose,
  onAddToPipeline,
  onRequestIntro,
  openToIntro = false,
  isInPipeline = false,
}: DossierPanelProps) {
  const [introState, setIntroState] = useState<IntroState>("idle");
  const { data: session } = useSession();
  const [recruiterProfile, setRecruiterProfile] = useState<{
    university: string | null;
    location: string | null;
    scholarshipType: string | null;
    sport: string | null;
    division: string | null;
    pitch: string | null;
  } | null>(null);

  useEffect(() => {
    const token = session?.accessToken as string | undefined;
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/recruiter/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setRecruiterProfile(data); })
      .catch(() => {});
  }, [session]);

  const recruiterName = session?.user?.name ?? session?.user?.email ?? "Recruiter";
  const recruiterInitials = recruiterName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const recruiterUniversity = recruiterProfile?.university ?? "";
  const recruiterPitch = (() => {
    if (recruiterProfile?.pitch) return recruiterProfile.pitch;
    if (!recruiterProfile?.university) return "";
    const parts = [
      recruiterProfile.sport && `${recruiterProfile.sport} program`,
      recruiterProfile.division && `competing at the ${recruiterProfile.division} level`,
      recruiterProfile.location && `based in ${recruiterProfile.location}`,
      recruiterProfile.scholarshipType && `offering ${recruiterProfile.scholarshipType.replace("_", " ")} scholarship opportunities`,
    ].filter(Boolean);
    return `${recruiterProfile.university}${parts.length ? " — " + parts.join(", ") + "." : "."}`;
  })();

  // Sync introState when the athlete changes — done during render (not in an
  // effect) to avoid react-hooks/set-state-in-effect. React re-renders once
  // when setState is called this way; the ref prevents infinite loops.
  const prevAthleteIdRef = useRef(athlete?.id);
  if (prevAthleteIdRef.current !== athlete?.id) {
    prevAthleteIdRef.current = athlete?.id;
    setIntroState(openToIntro ? "confirming" : "idle");
  }
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
                  {recruiterInitials}
                </div>
                <div>
                  <p className="font-semibold text-[#1A1A1A]">{recruiterName}</p>
                  {recruiterUniversity && (
                    <p className="text-xs text-[#ADA8A5]">{recruiterUniversity}</p>
                  )}
                </div>
              </div>
              {recruiterPitch ? (
                <p className="text-sm leading-relaxed text-[#4B4745]">{recruiterPitch}</p>
              ) : (
                <p className="text-sm italic text-[#ADA8A5]">
                  Complete your onboarding with Billy to generate your program pitch.
                </p>
              )}
            </div>

            <div className="mt-auto flex gap-3 pt-6">
              <button
                onClick={() => setIntroState("idle")}
                className="flex-1 rounded-xl border border-[#E8E3DD] py-2.5 text-sm font-medium text-[#6B6561] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!onRequestIntro) { setIntroState("error"); return; }
                  setIntroState("sending");
                  try {
                    const result = await onRequestIntro(athlete);
                    setIntroState(result === false ? "error" : "sent");
                  } catch {
                    setIntroState("error");
                  }
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

  if (introState === "sending") {
    return (
      <>
        <div className={backdropClass} onClick={handleClose} />
        <div className={panelClass}>
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <svg className="h-8 w-8 animate-spin text-[#ADA8A5]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-[#6B6561]">Sending request…</p>
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

  if (introState === "error") {
    return (
      <>
        <div className={backdropClass} onClick={handleClose} />
        <div className={panelClass}>
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <X size={24} className="text-red-500" />
            </div>
            <p className="text-lg font-semibold text-[#1A1A1A]">Request failed</p>
            <p className="max-w-[280px] text-sm leading-relaxed text-[#6B6561]">
              There was a problem sending the request. Make sure your account is verified and try again.
            </p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => setIntroState("confirming")}
                className="rounded-xl bg-[#1A1A1A] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3B6FE8]"
              >
                Try again
              </button>
              <button
                onClick={handleClose}
                className="rounded-xl border border-[#E8E3DD] px-8 py-2.5 text-sm font-medium text-[#6B6561] transition-colors hover:bg-[#EDEAE5]"
              >
                Close
              </button>
            </div>
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
              disabled={isInPipeline}
              className="flex-1 rounded-xl border border-[#E8E3DD] py-2.5 text-sm font-medium text-[#6B6561] transition-colors hover:bg-[#EDEAE5] hover:text-[#1A1A1A] disabled:border-[#C8E6C9] disabled:text-[#2E7D32] disabled:hover:bg-transparent"
            >
              {isInPipeline ? "Added to Pipeline ✓" : "Add to Pipeline"}
            </button>
            <button
              onClick={() => setIntroState("confirming")}
              className="flex-1 rounded-xl bg-[#1A1A1A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#3B6FE8]"
            >
              Request Introduction
            </button>
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
