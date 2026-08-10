// Green / yellow / red readiness signal for dossier completeness.
// Thresholds: "ready" mirrors the backend's 0.75 narrative-generation
// threshold; below 0.4 a profile is too thin to present to a coach.

export type ReadinessLevel = "ready" | "building" | "early";

export interface Readiness {
  level: ReadinessLevel;
  label: string;
  dot: string;
  text: string;
  bg: string;
}

export function getReadiness(score: number): Readiness {
  if (score >= 0.75) {
    return {
      level: "ready",
      label: "Ready to present",
      dot: "#2E7D32",
      text: "#2E7D32",
      bg: "#E8F1E8",
    };
  }
  if (score >= 0.4) {
    return {
      level: "building",
      label: "In progress",
      dot: "#B45309",
      text: "#B45309",
      bg: "#FEF3C7",
    };
  }
  return {
    level: "early",
    label: "Just getting started",
    dot: "#C0392B",
    text: "#C0392B",
    bg: "#FDECEA",
  };
}

export function ReadinessBadge({
  score,
  showPercent = false,
}: {
  score: number;
  showPercent?: boolean;
}) {
  const readiness = getReadiness(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: readiness.bg, color: readiness.text }}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: readiness.dot }}
      />
      {readiness.label}
      {showPercent ? ` · ${Math.round(score * 100)}%` : ""}
    </span>
  );
}
