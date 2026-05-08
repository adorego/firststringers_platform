import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "highlight";
}

export default function Card({
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) {
  const base = "rounded-xl p-6";

  const variants = {
    default: "border border-fs-border-gray bg-white",
    bordered: "border-2 border-fs-black bg-white",
    highlight: "border border-fs-purple/30 bg-fs-purple/5",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
