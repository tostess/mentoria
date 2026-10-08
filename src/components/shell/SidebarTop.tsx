import type { ReactNode } from "react";
import { Ficha } from "@/components/ui/Ficha";
import type { Shell } from "@/lib/roles";
import { cap, type Terms } from "@/lib/terms";

/**
 * Bloco de topo da sidebar, por papel.
 *
 * Só aparece onde há número verdadeiro para mostrar. Os placeholders da Etapa 1
 * saíram: presente do Parceiro é F8 e saldo do contrato do RH é F2, e um número
 * inventado na tela de quem cuida do dinheiro é pior que nenhum — a mesma
 * decisão já tomada para o admin.
 *
 * O saldo do Profissional chega por prop, lido no layout pelo cliente da sessão
 * dele (PostgREST, sob RLS). Não pode ser lido aqui: a sidebar renderiza em
 * paralelo com a página, e consulta Drizzle concorrente entala a conexão de
 * `max: 1`.
 */
export function SidebarTop({
  shell,
  terms,
  saldo,
}: {
  shell: Shell;
  terms: Terms;
  /** Fichas na carteira do Profissional. `null` quando não há carteira. */
  saldo?: number | null;
}) {
  if (shell === "professional" && saldo !== null && saldo !== undefined) {
    return (
      <Purse label={`${terms.fichas} disponíveis`} value={saldo}>
        <Ficha size="l" />
      </Purse>
    );
  }
  return null;
}

function Purse({
  label,
  value,
  children,
}: {
  label: string;
  value: number | string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-surface px-3 py-[11px]">
      <div className="flex items-center gap-[9px]">
        {children}
        <div>
          <div className="font-display text-[30px] font-bold leading-none">{value}</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-stone">
            {cap(label)}
          </div>
        </div>
      </div>
    </div>
  );
}
