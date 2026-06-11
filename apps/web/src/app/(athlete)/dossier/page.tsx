"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDossierStore } from "@/stores/dossier-store";

interface DossierSection {
  title: string;
  fields: { label: string; value: string | null }[];
}

function toSection(
  title: string,
  fields: { label: string; value: string | null }[],
): DossierSection {
  return { title, fields };
}

function buildSections(
  data: NonNullable<ReturnType<typeof useDossierStore.getState>["data"]>,
): DossierSection[] {
  const identity = data.identity ?? {};
  const performance = data.performance ?? {};
  const academic = data.academic ?? {};
  const availability = data.availability ?? {};
  const media = data.media ?? {};
  const character = data.character ?? {};

  return [
    toSection("Athlete Identity", [
      { label: "Sport", value: identity.sport ?? null },
      { label: "Position", value: identity.position ?? null },
      { label: "Location", value: identity.location ?? null },
      { label: "School", value: identity.school ?? null },
      { label: "Club / Team", value: identity.club ?? null },
      { label: "Competitive Level", value: identity.competitiveLevel ?? null },
      {
        label: "Graduation Year",
        value: identity.graduationYear?.toString() ?? null,
      },
    ]),
    toSection("Athletic Snapshot", [
      { label: "Height", value: performance.physicalProfile?.height ?? null },
      { label: "Weight", value: performance.physicalProfile?.weight ?? null },
      {
        label: "Dominant Side",
        value: performance.physicalProfile?.dominantSide ?? null,
      },
      { label: "League Level", value: performance.leagueLevel ?? null },
      ...(performance.stats
        ? Object.entries(performance.stats).map(([key, val]) => ({
            label: key,
            value: val?.toString() ?? null,
          }))
        : []),
      {
        label: "Strengths",
        value: performance.strengths?.join(", ") ?? null,
      },
      {
        label: "Physical Status",
        value: performance.physicalStatus ?? null,
      },
      { label: "Player Archetype", value: performance.archetype ?? null },
    ]),
    toSection("Academic", [
      { label: "GPA", value: academic.gpa?.toString() ?? null },
      { label: "SAT/ACT", value: academic.satAct?.toString() ?? null },
      { label: "Intended Major", value: academic.intendedMajor ?? null },
      {
        label: "NCAA Eligibility",
        value:
          academic.ncaaEligibility !== undefined
            ? academic.ncaaEligibility
              ? "Yes"
              : "No"
            : null,
      },
      {
        label: "Academic Interests",
        value: academic.academicInterests?.join(", ") ?? null,
      },
    ]),
    toSection("Recruiting Direction", [
      {
        label: "Target Level",
        value: availability.competitiveLevelGoal ?? null,
      },
      {
        label: "Recruiting Goals",
        value: availability.goals?.join(", ") ?? null,
      },
      { label: "Timeline", value: availability.timeline ?? null },
      {
        label: "Preferred Regions",
        value: availability.preferredRegions?.join(", ") ?? null,
      },
      {
        label: "Relocation Openness",
        value: availability.relocationOpenness ?? null,
      },
      {
        label: "Transfer Portal",
        value:
          availability.transferPortal !== undefined
            ? availability.transferPortal
              ? "Yes"
              : "No"
            : null,
      },
      {
        label: "Scholarship Need",
        value:
          availability.scholarshipNeed !== undefined
            ? availability.scholarshipNeed
              ? "Yes"
              : "No"
            : null,
      },
      {
        label: "Non-negotiables",
        value: availability.nonNegotiables?.join(", ") ?? null,
      },
      {
        label: "Limitations",
        value: availability.limitations?.join(", ") ?? null,
      },
    ]),
    toSection("Representation Assets", [
      {
        label: "Highlights",
        value: media.highlightUrls?.join(", ") ?? null,
      },
      { label: "Clips", value: media.clipUrls?.join(", ") ?? null },
      { label: "Instagram", value: media.socialMedia?.instagram ?? null },
      { label: "Twitter/X", value: media.socialMedia?.twitter ?? null },
      { label: "Hudl", value: media.socialMedia?.hudl ?? null },
      {
        label: "References",
        value: media.references?.join(", ") ?? null,
      },
    ]),
    toSection("Competitive Identity", [
      {
        label: "Self-Representation",
        value: character.selfRepresentation ?? null,
      },
      {
        label: "Growth Areas",
        value: character.growthAreas?.join(", ") ?? null,
      },
      { label: "Mentality", value: character.mentality ?? null },
      { label: "Leadership", value: character.leadership ?? null },
      { label: "Coachability", value: character.coachability ?? null },
      { label: "Resilience", value: character.resilience ?? null },
      { label: "Motivation", value: character.motivation ?? null },
    ]),
  ];
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DossierPage() {
  const { data: session } = useSession();
  const data = useDossierStore((s) => s.data);
  const lastUpdated = useDossierStore((s) => s.lastUpdated);
  const subscribe = useDossierStore((s) => s.subscribe);
  const fetchDossier = useDossierStore((s) => s.fetchDossier);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    const token = session?.accessToken;
    if (token && !useDossierStore.getState().data) {
      fetchDossier(token);
    }
  }, [session?.accessToken, fetchDossier]);

  const sections = data ? buildSections(data) : [];

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Your Dossier</h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          Growing with every conversation
          {lastUpdated ? <> &middot; Updated {timeAgo(lastUpdated)}</> : null}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-2xl">
          {sections.length === 0 ? (
            <div className="rounded-2xl bg-[#EDEDEA] px-5 py-10">
              <p className="text-center text-sm text-[#A0A0A0]">
                Start chatting with Jerry to build your dossier.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.title} className="rounded-2xl bg-[#EDEDEA] px-5 py-4">
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-[#2D2D2D]">
                      {section.title}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {section.fields.map((field) => (
                      <div
                        key={field.label}
                        className="flex items-center justify-between border-b border-[#E0E0DC] pb-3 last:border-0 last:pb-0"
                      >
                        <span className="text-sm text-[#A0A0A0]">{field.label}</span>
                        {field.value ? (
                          <span className="text-sm font-medium text-[#2D2D2D]">
                            {field.value}
                          </span>
                        ) : (
                          <span className="text-xs text-[#C0C0BC]">
                            Tell Jerry
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
