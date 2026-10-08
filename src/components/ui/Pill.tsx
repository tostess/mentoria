"use client";

import type { ReactNode } from "react";

export type PillVariant = "neutral" | "on" | "wait" | "off" | "bad" | "accent";

const FIXED: Record<Exclude<PillVariant, "accent">, string> = {
  neutral: "bg-mist text-stone",
  on: "bg-success-soft text-success",
  wait: "bg-gold-soft text-gold-text",
  off: "bg-off-soft text-off",
  bad: "bg-danger-soft text-danger",
};

export function Pill({
  variant = "neutral",
  className = "",
  children,
}: {
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}) {
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em]";
  if (variant === "accent") {
    return (
      <span className={`${base} bg-accent-12 text-on-soft ${className}`}>{children}</span>
    );
  }
  return <span className={`${base} ${FIXED[variant]} ${className}`}>{children}</span>;
}
