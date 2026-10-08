"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";

export type ButtonVariant = "primary" | "ghost" | "warn" | "gold";
export type ButtonSize = "md" | "sm";

type Props = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-[17px] py-[10px] text-[13.5px] rounded-[10px]",
  sm: "px-3 py-[6px] text-[12.5px] rounded-[8px]",
};

const FIXED: Record<Exclude<ButtonVariant, "primary">, string> = {
  ghost: "bg-surface text-ink border border-line2 hover:bg-blush hover:border-blush",
  warn: "bg-danger text-white hover:brightness-110",
  gold: "bg-gold text-white hover:brightness-110",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  style,
  children,
  ...rest
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[filter,background-color,border-color] duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const variantClass =
    variant === "primary" ? "bg-accent text-on-accent hover:brightness-110" : FIXED[variant];

  return (
    <button
      className={`${base} ${SIZE[size]} ${variantClass} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </button>
  );
}
