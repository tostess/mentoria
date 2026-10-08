"use client";


export type RailSlot = { label: string; taken?: boolean };

type Props = {
  /** Rótulo do dia, ex. "Seg 28". Já convertido para o fuso de quem vê. */
  day: string;
  slots: RailSlot[];
  onPick?: (label: string) => void;
  className?: string;
};

function Slot({ slot, onPick }: { slot: RailSlot; onPick?: (label: string) => void }) {
  const base =
    "rounded-[8px] border px-[11px] py-[6px] font-mono text-[12px] font-medium transition-colors duration-100";

  if (slot.taken) {
    return (
      <button
        type="button"
        disabled
        className={`${base} cursor-not-allowed border-line bg-mist text-pale line-through`}
      >
        {slot.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${base} cursor-pointer border-line2 bg-surface text-deep hover:border-accent hover:bg-accent hover:text-on-accent focus:border-accent focus:bg-accent focus:text-on-accent`}
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
    <div className={`rounded-[12px] border border-line bg-surface px-3.5 py-3 ${className}`}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em]">{day}</span>
        <span className="font-mono text-[10px] text-stone">
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
