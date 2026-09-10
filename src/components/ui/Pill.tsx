"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onSoft, withAlpha } from "@/lib/theme";

export type PillVariant = "neutral" | "on" | "wait" | "off" | "bad" | "accent";

const FIXED: Record<Exclude<PillVariant, "accent">, string> = {
  neutral: "bg-[#FDF8FB] text-[#8E7C86]",
  on: "bg-[#EAF6F0] text-[#2E6B52]",
  wait: "bg-[#FBF1DE] text-[#8A5D0C]",
  off: "bg-[#F4F1F3] text-[#948A90]",
  bad: "bg-[#FBEAE7] text-[#A63A2E]",
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
  const theme = useTheme();
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] font-mono text-[9.5px] uppercase tracking-[0.08em]";
  if (variant === "accent") {
    return (
      <span
        className={`${base} ${className}`}
        style={{ backgroundColor: withAlpha(theme.accent, 0.12), color: onSoft(theme.accent) }}
      >
        {children}
      </span>
    );
  }
  return <span className={`${base} ${FIXED[variant]} ${className}`}>{children}</span>;
}
