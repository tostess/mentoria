"use client";

import type { ReactNode } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onSoft, withAlpha } from "@/lib/theme";

type Props = {
  variant?: "accent" | "gold";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Note({ variant = "accent", icon, className = "", children }: Props) {
  const theme = useTheme();
  const base = "flex gap-[11px] rounded-[12px] px-[15px] py-[13px] text-[13px] leading-[1.5]";
  if (variant === "gold") {
    return (
      <div className={`${base} bg-[#FBF1DE] text-[#7A5209] ${className}`}>
        {icon && <span className="shrink-0">{icon}</span>}
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div
      className={`${base} ${className}`}
      style={{ backgroundColor: withAlpha(theme.accent, 0.1), color: onSoft(theme.accent) }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
