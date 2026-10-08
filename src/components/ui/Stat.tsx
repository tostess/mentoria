import type { ReactNode } from "react";
import { Icone } from "./Icone";
import type { NomeIcone } from "./icones";

type Props = {
  value: ReactNode;
  label: string;
  /** `gold` é reservado para a ficha. */
  tone?: "default" | "gold";
  /** Ícone discreto no canto — reconhecimento de relance, não decoração. */
  icone?: NomeIcone;
  className?: string;
};

export function Stat({ value, label, tone = "default", icone, className = "" }: Props) {
  const surface =
    tone === "gold" ? "bg-gold-soft border-transparent" : "bg-surface border-line";
  const labelColor = tone === "gold" ? "text-gold-text" : "text-stone";
  const iconColor = tone === "gold" ? "text-gold-pale" : "text-ghost";
  return (
    <div className={`relative rounded-[14px] border p-[18px] ${surface} ${className}`}>
      {icone && (
        <Icone nome={icone} tamanho={20} className={`absolute right-4 top-4 ${iconColor}`} />
      )}
      <div className="font-display text-[38px] font-bold leading-[0.9]">{value}</div>
      <div className={`mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] ${labelColor}`}>
        {label}
      </div>
    </div>
  );
}
