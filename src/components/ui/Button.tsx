"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";

export type ButtonVariant = "primary" | "ghost" | "warn" | "gold";
export type ButtonSize = "md" | "sm";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-[17px] py-[10px] text-[13.5px] rounded-[10px]",
  sm: "px-3 py-[6px] text-[12.5px] rounded-[8px]",
};

const FIXED: Record<Exclude<ButtonVariant, "primary">, string> = {
  ghost: "bg-white text-[#2A1B26] border border-[#EAD6E1] hover:bg-[#FCEDF4] hover:border-[#FCEDF4]",
  warn: "bg-[#A63A2E] text-white hover:brightness-110",
  gold: "bg-[#C98A2E] text-white hover:brightness-110",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  style,
  children,
  ...rest
}: Props) {
  const theme = useTheme();
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[filter,background-color,border-color] duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2";
  const variantClass = variant === "primary" ? "hover:brightness-110" : FIXED[variant];
  const variantStyle =
    variant === "primary"
      ? { backgroundColor: theme.accent, color: onAccent(theme.accent), outlineColor: theme.accent }
      : { outlineColor: theme.accent };

  return (
    <button
      className={`${base} ${SIZE[size]} ${variantClass} ${className}`}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
