interface ProgressBarProps {
  value: number; // 0–100
  size?: "sm" | "md";
  className?: string;
}

function getColor(value: number): string {
  if (value >= 100) return "bg-fs-black";
  if (value >= 75) return "bg-fs-green";
  if (value >= 50) return "bg-fs-amber";
  return "bg-fs-red";
}

export default function ProgressBar({
  value,
  size = "md",
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-fs-light-gray ${height} ${className}`}
    >
      <div
        className={`${height} rounded-full transition-all duration-500 ${getColor(clamped)}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
