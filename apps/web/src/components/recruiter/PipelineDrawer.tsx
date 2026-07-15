"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp } from "lucide-react";
import { api, PipelineEntry } from "@/lib/api";
import { AthleteResult } from "@/hooks/useBilly";

function toAthleteResult(entry: PipelineEntry): AthleteResult {
  return {
    id: entry.athleteId,
    fullName: entry.fullName,
    sport: entry.sport ?? "",
    position: entry.position ?? "",
    completenessScore: entry.completenessScore,
    ncaaEligible: false,
    dossier: entry.latestUpdate ? { recruiterPitch: entry.latestUpdate.content } : undefined,
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface PipelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hiddenAthleteIds?: Set<string>;
  onViewDossier?: (athlete: AthleteResult) => void;
  onRequestIntro?: (athlete: AthleteResult) => void;
}

export function PipelineDrawer({ isOpen, onClose, hiddenAthleteIds, onViewDossier, onRequestIntro }: PipelineDrawerProps) {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for an in-flight fetch triggered by the drawer opening
    setLoading(true);
    api
      .getPipeline()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

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
              <span className="text-sm text-[#ADA8A5]">{entries.length} evaluating</span>
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

        {loading && (
          <p className="px-7 py-6 text-sm text-[#ADA8A5]">Loading…</p>
        )}

        {!loading && entries.length === 0 && (
          <p className="px-7 py-6 text-sm text-[#ADA8A5]">
            No athletes in your pipeline yet. Use &quot;Add to Pipeline&quot; from a search
            result or dossier to start tracking prospects.
          </p>
        )}

        {/* Athlete list */}
        <div className="divide-y divide-[#E8E3DD]">
          {entries.filter((e) => !hiddenAthleteIds?.has(e.athleteId)).map((entry) => {
            const initials = entry.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2);

            const metaParts = [
              entry.position,
              entry.graduationYear,
              entry.school,
            ].filter(Boolean);

            return (
              <div key={entry.pipelineId} className="px-7 py-6">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#EDEAE5] text-base font-bold text-[#6B6561]">
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold text-[#1A1A1A]">{entry.fullName}</p>
                    {metaParts.length > 0 && (
                      <p className="text-sm text-[#ADA8A5]">{metaParts.join(" · ")}</p>
                    )}
                    <p className="mt-1 text-xs text-[#ADA8A5]">
                      Profile {Math.round(entry.completenessScore * 100)}% complete
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <button
                        onClick={() => onViewDossier?.(toAthleteResult(entry))}
                        className="font-medium text-[#3B6FE8] hover:underline"
                      >
                        View Dossier ›
                      </button>
                      <span className="text-[#C4BDBA]">·</span>
                      <button
                        onClick={() => onRequestIntro?.(toAthleteResult(entry))}
                        className="text-[#6B6561] transition-colors hover:text-[#1A1A1A]"
                      >
                        Request Introduction
                      </button>
                    </div>
                  </div>
                </div>

                {/* What the athlete last reported to Jerry (training, games,
                    achievements) — falls back to Jerry's pitch if there's
                    nothing newer to show. */}
                <div className="mt-4 rounded-xl bg-[#F0EDE9] px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <TrendingUp size={13} className="text-[#ADA8A5]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#ADA8A5]">
                      {entry.latestUpdate
                        ? entry.latestUpdate.source === "athlete"
                          ? `Latest update · ${timeAgo(entry.latestUpdate.publishedAt)}`
                          : `Jerry's pitch · ${timeAgo(entry.latestUpdate.publishedAt)}`
                        : "No updates yet"}
                    </span>
                  </div>
                  <p className="text-sm text-[#4B4745]">
                    {entry.latestUpdate
                      ? entry.latestUpdate.content
                      : "This athlete hasn't shared an update through Jerry yet."}
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
