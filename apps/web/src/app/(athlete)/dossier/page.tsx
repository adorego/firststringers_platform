"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDossierStore } from "@/stores/dossier-store";

interface DossierSection {
  title: string;
  completed: number;
  total: number;
  fields: { label: string; value: string | null }[];
}

function toSection(
  title: string,
  fields: { label: string; value: string | null }[],
): DossierSection {
  return {
    title,
    fields,
    completed: fields.filter((f) => f.value !== null).length,
    total: fields.length,
  };
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

export default function DossierPage() {
  const { data: session } = useSession();
  const data = useDossierStore((s) => s.data);
  const completeness = useDossierStore((s) => s.completeness);
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
  const total = sections.reduce((a, s) => a + s.completed, 0);
  const totalFields = sections.reduce((a, s) => a + s.total, 0);
  const pct = Math.round(completeness * 100);

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#2D2D2D]">Your Dossier</h1>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          {pct}% complete &middot; {total}/{totalFields} fields
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-[#E0E0DC]">
          <div
            className="h-full rounded-full bg-[#3D3D3D] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
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
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#2D2D2D]">
                      {section.title}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        section.completed === section.total
                          ? "bg-[#3D3D3D] text-white"
                          : "bg-[#E0E0DC] text-[#6B6B6B]"
                      }`}
                    >
                      {section.completed}/{section.total}
                    </span>
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
                            Complete with Jerry
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
