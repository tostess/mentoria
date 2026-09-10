import type { ReactNode } from "react";
import { Ficha } from "@/components/ui/Ficha";
import type { Shell } from "@/lib/roles";
import { cap, terms } from "@/lib/terms";

/**
 * Bloco de topo da sidebar, por papel. Números são placeholder da Etapa 1 —
 * passam a vir do banco quando cada papel ganhar sua fase.
 */
export function SidebarTop({ shell }: { shell: Shell }) {
  switch (shell) {
    case "professional":
      return (
        <Purse label={`${terms.fichas} disponíveis`} value={2}>
          <Ficha size="l" />
        </Purse>
      );
    case "partner":
      return (
        <Purse label="presentes este mês" value="3 de 3">
          <Ficha size="l" />
        </Purse>
      );
    case "org":
      return (
        <Purse label={`${terms.fichas} no contrato`} value={48}>
          <Ficha size="l" />
        </Purse>
      );
    case "admin":
      return (
        <div className="rounded-[12px] border border-[#F3E4EC] bg-white px-3 py-[11px]">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#8E7C86]">
            Circulação
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <Mini value={320} label="contratadas" />
            <Mini value={210} label="alocadas" />
            <Mini value={87} label="usadas" />
          </div>
        </div>
      );
  }
}

function Purse({ label, value, children }: { label: string; value: number | string; children: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#F3E4EC] bg-white px-3 py-[11px]">
      <div className="flex items-center gap-[9px]">
        {children}
        <div>
          <div className="font-display text-[30px] font-bold leading-none">{value}</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#8E7C86]">
            {cap(label)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-[22px] font-bold leading-none">{value}</div>
      <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#B3A3AC]">{label}</div>
    </div>
  );
}
