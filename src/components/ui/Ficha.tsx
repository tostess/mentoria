import { terms } from "@/lib/terms";

export type FichaSize = "s" | "m" | "l" | "xl";

const SIZE: Record<FichaSize, { outer: string; ring: string }> = {
  s: { outer: "h-4 w-4", ring: "inset-[2px] border" },
  m: { outer: "h-[22px] w-[22px]", ring: "inset-[3px] border" },
  l: { outer: "h-[38px] w-[38px]", ring: "inset-[5px] border-[1.5px]" },
  xl: { outer: "h-[70px] w-[70px]", ring: "inset-[9px] border-2" },
};

/**
 * A ficha é a única coisa dourada do sistema e deve parecer ficha, não botão.
 * Ouro fixo da paleta — não muda com o accent da empresa.
 */
export function Ficha({ size = "m", className = "" }: { size?: FichaSize; className?: string }) {
  const s = SIZE[size];
  return (
    <span
      role="img"
      aria-label={terms.ficha}
      className={`relative inline-block shrink-0 rounded-full bg-[linear-gradient(150deg,#EFC069,#C98A2E)] shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_1px_1px_rgba(90,58,2,0.18)] ${s.outer} ${className}`}
    >
      <span
        className={`absolute rounded-full border-dashed border-[rgba(255,255,255,0.65)] ${s.ring}`}
      />
    </span>
  );
}

/** Pilha de fichas sobrepostas, até `max`. */
export function FichaStack({ count, max = 6 }: { count: number; max?: number }) {
  const n = Math.max(0, Math.min(count, max));
  return (
    <span className="inline-flex items-center">
      {Array.from({ length: n }, (_, i) => (
        <Ficha
          key={i}
          size="m"
          className={i === 0 ? "" : "-ml-[6px] ring-[1.5px] ring-white"}
        />
      ))}
    </span>
  );
}
