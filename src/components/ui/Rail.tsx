"use client";

import { useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";

export type RailSlot = { label: string; taken?: boolean };

type Props = {
  /** Rótulo do dia, ex. "Seg 28". Já convertido para o fuso de quem vê. */
  day: string;
  slots: RailSlot[];
  onPick?: (label: string) => void;
  className?: string;
};

function Slot({ slot, onPick }: { slot: RailSlot; onPick?: (label: string) => void }) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);
  const base =
    "rounded-[8px] border px-[11px] py-[6px] font-mono text-[12px] font-medium transition-colors duration-100";

  if (slot.taken) {
    return (
      <button
        type="button"
        disabled
        className={`${base} cursor-not-allowed border-[#F3E4EC] bg-[#FDF8FB] text-[#C6B8C0] line-through`}
      >
        {slot.label}
      </button>
    );
  }

  const style = hover
    ? { backgroundColor: theme.accent, borderColor: theme.accent, color: onAccent(theme.accent) }
    : { backgroundColor: theme.white, borderColor: theme.line2, color: theme.deep };

  return (
    <button
      type="button"
      className={`${base} cursor-pointer`}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={() => onPick?.(slot.label)}
    >
      {slot.label}
    </button>
  );
}

/** Trilho de horários de um dia. Todo horário exibido aqui vem do motor de agenda. */
export function Rail({ day, slots, onPick, className = "" }: Props) {
  const free = slots.filter((s) => !s.taken).length;
  return (
    <div className={`rounded-[12px] border border-[#F3E4EC] bg-white px-3.5 py-3 ${className}`}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em]">{day}</span>
        <span className="font-mono text-[10px] text-[#8E7C86]">
          {free} {free === 1 ? "livre" : "livres"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <Slot key={slot.label} slot={slot} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}
