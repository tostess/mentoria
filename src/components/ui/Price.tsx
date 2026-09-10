import { Ficha } from "@/components/ui/Ficha";
import { countFichas } from "@/lib/terms";

/** Preço em fichas. Sempre com a ficha ao lado — nunca só o número. */
export function Price({ fichas, className = "" }: { fichas: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full bg-[#FBF1DE] py-1 pl-[6px] pr-[9px] font-mono text-[12px] font-semibold text-[#7A5209] ${className}`}
      aria-label={countFichas(fichas)}
    >
      <Ficha size="s" />
      {fichas}
    </span>
  );
}
