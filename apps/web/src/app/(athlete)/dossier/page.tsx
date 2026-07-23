"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronRight, Zap } from "lucide-react";
import ProgressBar from "@/components/ui/ProgressBar";
import { useDossierStore } from "@/stores/dossier-store";

type DossierData = NonNullable<ReturnType<typeof useDossierStore.getState>["data"]>;

interface DossierField {
  label: string;
  value: string | null;
}

interface DossierSection {
  title: string;
  description: string;
  fields: DossierField[];
}

interface TimelineItem {
  period: string;
  title: string;
  detail: string;
  status: "known" | "pending";
}

const emptyStateTitle = "Representation dossier pending";

function textValue(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.toString().trim();
  return normalized.length > 0 ? normalized : null;
}

function listValue(values: string[] | null | undefined): string | null {
  const normalized = values?.map((value) => value.trim()).filter(Boolean);
  return normalized && normalized.length > 0 ? normalized.join(", ") : null;
}

function boolValue(value: boolean | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value ? "Yes" : "No";
}

function toSection(
  title: string,
  description: string,
  fields: DossierField[],
): DossierSection {
  return { title, description, fields };
}

function knownCount(fields: DossierField[]): number {
  return fields.filter((field) => Boolean(field.value)).length;
}

function buildSections(data: DossierData): DossierSection[] {
  const identity = data.identity ?? {};
  const performance = data.performance ?? {};
  const academic = data.academic ?? {};
  const availability = data.availability ?? {};
  const media = data.media ?? {};
  const character = data.character ?? {};

  const statFields = performance.stats
    ? Object.entries(performance.stats).map(([key, val]) => ({
        label: key,
        value: textValue(val),
      }))
    : [];

  return [
    toSection("Athlete Profile", "Identity signals Jerry uses to anchor representation.", [
      { label: "Sport", value: textValue(identity.sport) },
      { label: "Position", value: textValue(identity.position) },
      { label: "Location", value: textValue(identity.location) },
      { label: "School", value: textValue(identity.school) },
      { label: "Club / Team", value: textValue(identity.club) },
      { label: "Competitive Level", value: textValue(identity.competitiveLevel) },
      { label: "Graduation Year", value: textValue(identity.graduationYear) },
      { label: "Nationality", value: textValue(identity.nationality) },
    ]),
    toSection("Athletic Development", "Physical, statistical, and competitive context.", [
      { label: "Height", value: textValue(performance.physicalProfile?.height) },
      { label: "Weight", value: textValue(performance.physicalProfile?.weight) },
      { label: "Speed", value: textValue(performance.physicalProfile?.speed) },
      { label: "Vertical", value: textValue(performance.physicalProfile?.vertical) },
      { label: "Dominant Side", value: textValue(performance.physicalProfile?.dominantSide) },
      { label: "League Level", value: textValue(performance.leagueLevel) },
      { label: "Player Archetype", value: textValue(performance.archetype) },
      { label: "Strengths", value: listValue(performance.strengths) },
      { label: "Physical Status", value: textValue(performance.physicalStatus) },
      ...statFields,
    ]),
    toSection("Academic", "Academic readiness and eligibility context.", [
      { label: "GPA", value: textValue(academic.gpa) },
      { label: "SAT/ACT", value: textValue(academic.satAct) },
      { label: "Intended Major", value: textValue(academic.intendedMajor) },
      { label: "NCAA Eligibility", value: boolValue(academic.ncaaEligibility) },
      { label: "Academic Interests", value: listValue(academic.academicInterests) },
    ]),
    toSection("Recruiting Direction", "Goals, timing, fit preferences, and constraints.", [
      { label: "Target Level", value: textValue(availability.competitiveLevelGoal) },
      { label: "Recruiting Goals", value: listValue(availability.goals) },
      { label: "Timeline", value: textValue(availability.timeline) },
      { label: "Preferred Regions", value: listValue(availability.preferredRegions) },
      { label: "Relocation Openness", value: textValue(availability.relocationOpenness) },
      { label: "Transfer Portal", value: boolValue(availability.transferPortal) },
      { label: "Scholarship Need", value: boolValue(availability.scholarshipNeed) },
      { label: "Non-negotiables", value: listValue(availability.nonNegotiables) },
      { label: "Limitations", value: listValue(availability.limitations) },
    ]),
    toSection("Film & Media", "Representation assets Jerry can reference when advocating.", [
      { label: "Highlights", value: listValue(media.highlightUrls ?? performance.highlightUrls) },
      { label: "Clips", value: listValue(media.clipUrls) },
      { label: "Instagram", value: textValue(media.socialMedia?.instagram) },
      { label: "Twitter/X", value: textValue(media.socialMedia?.twitter) },
      { label: "Hudl", value: textValue(media.socialMedia?.hudl) },
      { label: "References", value: listValue(media.references) },
    ]),
    toSection("Characteristics", "Human signals behind fit, resilience, and growth.", [
      { label: "Self-Representation", value: textValue(character.selfRepresentation) },
      { label: "Leadership", value: textValue(character.leadership) },
      { label: "Coachability", value: textValue(character.coachability) },
      { label: "Mentality", value: textValue(character.mentality) },
      { label: "Resilience", value: textValue(character.resilience) },
      { label: "Motivation", value: textValue(character.motivation) },
      { label: "Growth Areas", value: listValue(character.growthAreas) },
    ]),
  ];
}

function buildSummary({
  data,
  displayName,
  sections,
}: {
  data: DossierData | null;
  displayName: string;
  sections: DossierSection[];
}): string {
  if (!data) {
    return `${displayName}'s Athlete Dossier has not been activated yet. Jerry is ready to begin collecting the identity, athletic, academic, recruiting, and character signals needed to represent the athlete with context.`;
  }

  const identity = data.identity ?? {};
  const performance = data.performance ?? {};
  const academic = data.academic ?? {};
  const availability = data.availability ?? {};
  const character = data.character ?? {};

  const totalKnown = sections.reduce((sum, section) => sum + knownCount(section.fields), 0);
  const totalFields = sections.reduce((sum, section) => sum + section.fields.length, 0);
  const pending = Math.max(0, totalFields - totalKnown);

  const signals = [
    identity.position || identity.sport
      ? `${identity.position ?? identity.sport}${identity.sport && identity.position ? ` in ${identity.sport}` : ""}`
      : null,
    identity.school ? `at ${identity.school}` : null,
    academic.gpa ? `with a ${academic.gpa} GPA academic signal` : null,
    performance.archetype ? `profiled as ${performance.archetype}` : null,
    character.leadership ? `with leadership context captured` : null,
    availability.competitiveLevelGoal
      ? `targeting ${availability.competitiveLevelGoal}`
      : null,
  ].filter(Boolean);

  const base =
    signals.length > 0
      ? `${displayName}'s dossier currently anchors around ${signals.join(", ")}.`
      : `${displayName}'s dossier has started, but Jerry still needs the core signals that make representation precise.`;

  const completion =
    pending > 0
      ? ` Jerry has ${totalKnown} known signals and ${pending} pending details to complete the first representation layer.`
      : " Jerry has enough core context to present a complete initial representation layer.";

  return `${base}${completion}`;
}

function buildTimeline(sections: DossierSection[]): TimelineItem[] {
  return sections.map((section) => {
    const known = knownCount(section.fields);
    const total = section.fields.length;
    const status = known > 0 ? "known" : "pending";
    return {
      period: status === "known" ? "KNOWN" : "PENDING",
      title: section.title,
      detail:
        status === "known"
          ? `${known}/${total} signals captured`
          : `Jerry still needs ${section.title.toLowerCase()} context`,
      status,
    };
  });
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

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function completionLabel(completeness: number): string {
  if (completeness >= 90) return "Representation ready";
  if (completeness >= 60) return "Strong foundation";
  if (completeness > 0) return "Activation in progress";
  return "Waiting for activation";
}

function DossierSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading dossier">
      <div className="h-44 animate-pulse rounded-[28px] bg-[#F3F0EC]" />
      <div className="h-36 animate-pulse rounded-[28px] bg-[#F3F0EC]/70" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-[#EBE8E4]/70" />
        ))}
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: DossierField }) {
  const known = Boolean(field.value);

  return (
    <div className="grid gap-2 border-t border-[#27251E]/5 py-4 sm:grid-cols-[minmax(0,180px)_1fr_auto] sm:items-start sm:gap-5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#27251E]/45">
        {field.label}
      </dt>
      <dd className={`text-sm leading-6 ${known ? "text-[#27251E]" : "text-[#27251E]/35"}`}>
        {field.value ?? "Waiting for Jerry"}
      </dd>
      <span
        className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${
          known
            ? "bg-[#DDE5EF] text-[#4A5F79]"
            : "border border-[#27251E]/10 text-[#27251E]/35"
        }`}
      >
        {known ? "Known" : "Pending"}
      </span>
    </div>
  );
}

function SectionAccordion({
  section,
  open,
  onToggle,
}: {
  section: DossierSection;
  open: boolean;
  onToggle: () => void;
}) {
  const known = knownCount(section.fields);

  return (
    <section className="border-t border-[#27251E]/5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-4 px-0 py-5 text-left transition-opacity hover:opacity-75"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              known > 0 ? "bg-[#6F7F95]" : "bg-[#27251E]/20"
            }`}
          />
          <span className="min-w-0">
            <span className="block text-base font-medium text-[#27251E]">{section.title}</span>
            <span className="mt-1 block text-xs leading-5 text-[#27251E]/45">
              {section.description}
            </span>
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-3">
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-[#27251E]/45 sm:inline">
            {known}/{section.fields.length} known
          </span>
          <ChevronRight
            size={15}
            className={`text-[#27251E]/40 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          />
        </span>
      </button>

      {open ? (
        <dl className="pb-6">
          {section.fields.map((field) => (
            <FieldRow key={field.label} field={field} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

export default function DossierPage() {
  const { data: session } = useSession();
  const data = useDossierStore((s) => s.data);
  const completeness = useDossierStore((s) => s.completeness);
  const loading = useDossierStore((s) => s.loading);
  const lastUpdated = useDossierStore((s) => s.lastUpdated);
  const subscribe = useDossierStore((s) => s.subscribe);
  const fetchDossier = useDossierStore((s) => s.fetchDossier);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    const token = session?.accessToken;
    if (token && !useDossierStore.getState().data) {
      fetchDossier(token);
    }
  }, [session?.accessToken, fetchDossier]);

  const displayName =
    session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Athlete";
  const initials = initialsFromName(displayName);
  const sections = useMemo(() => (data ? buildSections(data) : []), [data]);
  const timeline = useMemo(() => buildTimeline(sections), [sections]);
  const summary = useMemo(
    () => buildSummary({ data, displayName, sections }),
    [data, displayName, sections],
  );

  const identity = data?.identity ?? {};
  const performance = data?.performance ?? {};
  const clampedCompleteness = Math.min(100, Math.max(0, completeness ?? 0));
  const knownSignals = sections.reduce((sum, section) => sum + knownCount(section.fields), 0);
  const totalSignals = sections.reduce((sum, section) => sum + section.fields.length, 0);
  const knownSignalsLabel =
    totalSignals > 0
      ? `${knownSignals}/${totalSignals} known details`
      : "Waiting for first details";
  const meta = [
    identity.position ?? identity.sport,
    identity.graduationYear ? `Class of ${identity.graduationYear}` : null,
    identity.school,
  ].filter(Boolean);

  const toggleSection = (title: string) => {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  return (
    <div className="min-h-full bg-[#FAF8F5] text-[#27251E]">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-5 pt-6 pb-28 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-[#27251E]/5 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#27251E]/45">
              Athlete Intelligence Dossier
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#27251E] sm:text-5xl">
              A living representation briefing for {displayName}.
            </h1>
          </div>
          <div className="min-w-[220px] rounded-2xl bg-[#F3F0EC]/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#27251E]/45">
                Dossier completion
              </span>
              <span className="text-sm font-medium text-[#27251E]">
                {clampedCompleteness}%
              </span>
            </div>
            <ProgressBar value={clampedCompleteness} size="sm" className="bg-[#EBE8E4]" />
            <p className="mt-3 text-xs leading-5 text-[#27251E]/55">
              {completionLabel(clampedCompleteness)}
              {lastUpdated ? <> · Updated {timeAgo(lastUpdated)}</> : null}
            </p>
          </div>
        </header>

        {loading && !data ? (
          <DossierSkeleton />
        ) : (
          <main className="overflow-hidden rounded-[32px] border border-[#27251E]/5 bg-[#FAF8F5] shadow-[0_24px_80px_rgba(39,37,30,0.06)]">
            <section className="sticky top-0 z-10 border-b border-[#27251E]/5 bg-[#FAF8F5]/95 px-5 py-6 backdrop-blur sm:px-10 sm:py-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-5 sm:gap-7">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-md border border-[#27251E]/10 bg-[#EBE8E4] text-xl font-medium tracking-[-0.04em] text-[#27251E]/70">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-medium tracking-[-0.04em] text-[#27251E] sm:text-3xl">
                      {displayName}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#27251E]/50">
                      {meta.length > 0 ? meta.join(" · ") : "Core identity pending"}
                    </p>
                    <p className="mt-1 text-sm text-[#27251E]/50">
                      {identity.location ?? "Location pending"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-[#6F7F95]/25 bg-[#DDE5EF]/45 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#4A5F79]">
                    {lastUpdated ? "Jerry synced" : "Awaiting Jerry"}
                  </span>
                  <Link
                    href="/chat"
                    className="rounded-full border border-[#27251E]/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#27251E]/55 transition-colors hover:bg-[#F3F0EC]"
                  >
                    Continue with Jerry
                  </Link>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 pl-0 text-sm text-[#27251E] sm:pl-[6.75rem]">
                <span>{performance.archetype ?? "Archetype pending"}</span>
                <span className="text-[#27251E]/60">
                  {performance.leagueLevel ?? identity.competitiveLevel ?? "Development level pending"}
                </span>
                <span className="flex items-center gap-1.5 text-[#4A5F79]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#6F7F95]" />
                  {clampedCompleteness > 0 ? "Evolving" : "Awaiting activation"}
                </span>
              </div>
            </section>

            <section className="bg-[#F3F0EC]/30 px-5 py-10 sm:px-10 sm:py-12">
              <div className="max-w-3xl">
                <div className="mb-6 flex items-center gap-2 text-[#27251E]">
                  <Zap size={16} className="text-[#6F7F95]" strokeWidth={1.7} />
                  <h2 className="text-xl font-medium tracking-[-0.03em]">
                    Intelligence Summary
                  </h2>
                </div>
                <p className="text-base font-light leading-[1.9] text-[#27251E]/80">
                  {summary}
                </p>
              </div>
            </section>

            <section className="px-5 py-10 sm:px-10 sm:py-12">
              <div className="max-w-3xl">
                <div className="mb-8 flex items-center gap-2 text-[#27251E]">
                  <span className="h-2 w-2 rounded-full bg-[#6F7F95]" />
                  <h2 className="text-xl font-medium tracking-[-0.03em]">
                    Development Timeline
                  </h2>
                </div>

                {timeline.length > 0 ? (
                  <ol className="space-y-8">
                    {timeline.map((item, index) => (
                      <li
                        key={item.title}
                        className={`grid grid-cols-[84px_1fr] gap-5 ${
                          item.status === "pending" ? "opacity-55" : ""
                        }`}
                      >
                        <span className="pt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#27251E]/45">
                          {item.period}
                        </span>
                        <span className="relative block border-l border-[#27251E]/10 pl-5">
                          <span
                            className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ${
                              index < 2 && item.status === "known"
                                ? "bg-[#6F7F95]"
                                : "bg-[#C9C3BB]"
                            }`}
                          />
                          <span className="block text-base font-medium text-[#27251E]">
                            {item.title}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-[#27251E]/55">
                            {item.detail}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="rounded-2xl bg-[#F3F0EC]/70 px-5 py-8">
                    <p className="text-sm leading-6 text-[#27251E]/55">
                      {emptyStateTitle}. Start chatting with Jerry to create the first
                      representation signals.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="bg-[#F3F0EC]/20 px-5 py-6 sm:px-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#27251E]/45">
                  Supporting Intelligence
                </p>
                <p className="text-xs text-[#27251E]/45">
                  {knownSignalsLabel}
                </p>
              </div>
            </section>

            <div className="px-5 pb-6 sm:px-10">
              {sections.length > 0 ? (
                sections.map((section) => (
                  <SectionAccordion
                    key={section.title}
                    section={section}
                    open={openSections.has(section.title)}
                    onToggle={() => toggleSection(section.title)}
                  />
                ))
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm leading-6 text-[#27251E]/55">
                    Start chatting with Jerry to build the Athlete Dossier.
                  </p>
                  <Link
                    href="/chat"
                    className="mt-5 inline-flex rounded-full bg-[#27251E] px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-[#FAF8F5] transition-opacity hover:opacity-85"
                  >
                    Open Jerry
                  </Link>
                </div>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
