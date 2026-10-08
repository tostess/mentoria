"use client";

import type { ReactNode } from "react";

type Props = {
  variant?: "accent" | "gold";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Note({ variant = "accent", icon, className = "", children }: Props) {
  const base = "flex gap-[11px] rounded-[12px] px-[15px] py-[13px] text-[13px] leading-[1.5]";
  if (variant === "gold") {
    return (
      <div className={`${base} bg-gold-soft text-gold-ink ${className}`}>
        {icon && <span className="shrink-0">{icon}</span>}
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div className={`${base} bg-accent-10 text-on-soft ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
