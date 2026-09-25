"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";
import type { ButtonSize, ButtonVariant } from "./Button";

/**
 * Botão que navega. Existe separado de `Button` porque um link tem de ser um
 * `<a>`: um `<button>` com `onClick={router.push}` perde o meio-clique, o
 * "abrir em nova aba" e o endereço na barra de status.
 *
 * As classes são as mesmas de `Button` de propósito — quando uma mudar, as duas
 * mudam juntas, e é isso que mantém o ouro do `variant="gold"` igual nas duas.
 */
const SIZE: Record<ButtonSize, string> = {
  md: "px-[17px] py-[10px] text-[13.5px] rounded-[10px]",
  sm: "px-3 py-[6px] text-[12.5px] rounded-[8px]",
};

const FIXED: Record<Exclude<ButtonVariant, "primary">, string> = {
  ghost: "bg-white text-[#2A1B26] border border-[#EAD6E1] hover:bg-[#FCEDF4] hover:border-[#FCEDF4]",
  warn: "bg-[#A63A2E] text-white hover:brightness-110",
  gold: "bg-[#C98A2E] text-white hover:brightness-110",
};

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[filter,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2";
  const variantClass = variant === "primary" ? "hover:brightness-110" : FIXED[variant];
  const variantStyle =
    variant === "primary"
      ? { backgroundColor: theme.accent, color: onAccent(theme.accent), outlineColor: theme.accent }
      : { outlineColor: theme.accent };

  return (
    <Link
      href={href}
      className={`${base} ${SIZE[size]} ${variantClass} ${className}`}
      style={variantStyle}
    >
      {children}
    </Link>
  );
}
