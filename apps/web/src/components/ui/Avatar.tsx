import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  sm: { container: "h-8 w-8", text: "text-xs", px: 32 },
  md: { container: "h-10 w-10", text: "text-sm", px: 40 },
  lg: { container: "h-12 w-12", text: "text-base", px: 48 },
  xl: { container: "h-16 w-16", text: "text-lg", px: 64 },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = "md",
  className = "",
}: AvatarProps) {
  const s = sizeMap[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={s.px}
        height={s.px}
        className={`rounded-full object-cover ${s.container} ${className}`}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-fs-black font-semibold text-fs-white ${s.container} ${s.text} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
