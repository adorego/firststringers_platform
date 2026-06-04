type BadgeVariant =
  | "default"
  | "athlete"
  | "recruiter"
  | "admin"
  | "active"
  | "inactive"
  | "pending"
  | "interested"
  | "sport"
  | "ai"
  | "new";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-fs-light-gray text-[#111827]",
  athlete: "bg-fs-blue/10 text-fs-blue",
  recruiter: "bg-fs-purple/10 text-fs-purple",
  admin: "bg-fs-amber/10 text-fs-amber",
  active: "bg-fs-green/10 text-fs-green",
  inactive: "bg-fs-muted/10 text-fs-muted",
  pending: "bg-fs-amber/10 text-fs-amber",
  interested: "bg-fs-green/10 text-fs-green",
  sport: "bg-fs-light-gray text-[#111827]",
  ai: "bg-fs-purple/10 text-fs-purple",
  new: "bg-fs-black text-fs-white",
};

export default function Badge({
  variant = "default",
  className = "",
  children,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
