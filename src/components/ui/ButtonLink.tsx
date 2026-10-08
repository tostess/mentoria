"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  ghost: "bg-surface text-ink border border-line2 hover:bg-blush hover:border-blush",
  warn: "bg-danger text-white hover:brightness-110",
  gold: "bg-gold text-white hover:brightness-110",
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
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[filter,background-color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const variantClass =
    variant === "primary" ? "bg-accent text-on-accent hover:brightness-110" : FIXED[variant];

  return (
    <Link
      href={href}
      className={`${base} ${SIZE[size]} ${variantClass} ${className}`}
    >
      {children}
    </Link>
  );
}
