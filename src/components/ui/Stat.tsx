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
    tone === "gold" ? "bg-[#FBF1DE] border-transparent" : "bg-white border-[#F3E4EC]";
  const labelColor = tone === "gold" ? "text-[#8A5D0C]" : "text-[#8E7C86]";
  const iconColor = tone === "gold" ? "text-[#E5C88F]" : "text-[#D9C3CF]";
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
