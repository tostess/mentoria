import type { ReactNode } from "react";

type Props = {
  value: ReactNode;
  label: string;
  /** `gold` é reservado para a ficha. */
  tone?: "default" | "gold";
  className?: string;
};

export function Stat({ value, label, tone = "default", className = "" }: Props) {
  const surface =
    tone === "gold" ? "bg-[#FBF1DE] border-transparent" : "bg-white border-[#F3E4EC]";
  const labelColor = tone === "gold" ? "text-[#8A5D0C]" : "text-[#8E7C86]";
  return (
    <div className={`rounded-[14px] border p-[18px] ${surface} ${className}`}>
      <div className="font-display text-[38px] font-bold leading-[0.9]">{value}</div>
      <div className={`mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] ${labelColor}`}>
        {label}
      </div>
    </div>
  );
}
