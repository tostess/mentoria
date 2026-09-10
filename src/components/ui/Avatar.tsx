"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<AvatarSize, string> = {
  sm: "h-[29px] w-[29px] rounded-[9px] text-[10.5px]",
  md: "h-10 w-10 rounded-[12px] text-[13px]",
  lg: "h-[58px] w-[58px] rounded-[16px] text-[18px]",
  xl: "h-[76px] w-[76px] rounded-[20px] text-[24px]",
};

type Props = {
  name: string;
  /** Cor de fundo. Sem ela, usa o accent do tema. */
  color?: string;
  photoUrl?: string | null;
  size?: AvatarSize;
  className?: string;
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, color, photoUrl, size = "md", className = "" }: Props) {
  const theme = useTheme();
  const bg = color ?? theme.accent;
  const base = `grid shrink-0 place-items-center overflow-hidden font-mono font-semibold ${SIZE[size]} ${className}`;
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- foto externa, sem domínio conhecido ainda
    return <img src={photoUrl} alt={name} className={`${base} object-cover`} />;
  }
  return (
    <div className={base} style={{ backgroundColor: bg, color: onAccent(bg) }} aria-label={name}>
      {initials(name)}
    </div>
  );
}
