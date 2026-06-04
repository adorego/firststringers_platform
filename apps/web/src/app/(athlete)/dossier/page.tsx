"use client";

import { useEffect } from "react";
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

  return [
    toSection("Personal Info", [
      { label: "Sport", value: identity.sport ?? null },
      { label: "Position", value: identity.position ?? null },
      { label: "Nationality", value: identity.nationality ?? null },
      {
        label: "Graduation Year",
        value: identity.graduationYear?.toString() ?? null,
      },
    ]),
    toSection("Athletic Stats", [
      { label: "League Level", value: performance.leagueLevel ?? null },
      ...(performance.stats
        ? Object.entries(performance.stats).map(([key, val]) => ({
            label: key,
            value: val?.toString() ?? null,
          }))
        : [{ label: "Stats", value: null }]),
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
    ]),
    toSection("Availability", [
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
        label: "Preferred Regions",
        value: availability.preferredRegions?.join(", ") ?? null,
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
    ]),
  ];
}

export default function DossierPage() {
  const { data, completeness, subscribe } = useDossierStore();

  useEffect(() => {
    subscribe();
  }, [subscribe]);

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
