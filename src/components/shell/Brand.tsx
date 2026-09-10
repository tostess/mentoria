"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";

/** Marca no topo da sidebar. Nome e accent vêm do tema resolvido. */
export function Brand({ sub }: { sub: string }) {
  const theme = useTheme();
  return (
    <div className="flex items-center gap-2.5 px-1">
      {theme.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logotipo da empresa, domínio variável
        <img src={theme.logoUrl} alt={theme.platformName} className="h-8 w-8 rounded-[10px] object-cover" />
      ) : (
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] font-mono text-[14px] font-semibold"
          style={{ backgroundColor: theme.accent, color: onAccent(theme.accent) }}
        >
          {theme.platformName.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <div className="font-display text-[22px] font-bold leading-none tracking-[-0.01em]">
          {theme.platformName}
        </div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#B3A3AC]">{sub}</div>
      </div>
    </div>
  );
}
