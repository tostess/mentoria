import type { ReactNode } from "react";
import { Ficha } from "@/components/ui/Ficha";
import type { Shell } from "@/lib/roles";
import { cap, type Terms } from "@/lib/terms";

/**
 * Bloco de topo da sidebar, por papel. Os números do Profissional, do
 * Parceiro e do RH ainda são placeholder da Etapa 1 — passam a vir do banco
 * quando cada papel ganhar sua fase (carteira na P3).
 */
export function SidebarTop({ shell, terms }: { shell: Shell; terms: Terms }) {
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
      // Sem bloco. Aqui havia três números fixos da Etapa 1 — dado falso na
      // tela de quem opera o dinheiro. Os reais estão no painel, e trazê-los
      // para cá exigiria uma consulta Drizzle concorrente com a da página, que
      // é justamente o que entala a conexão de `max: 1`.
      return null;
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
