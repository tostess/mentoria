import type postgres from "postgres";
import type { Role } from "@/lib/auth/claims";
import { paraJsonb } from "@/lib/db/jsonb";

/**
 * Invariante 12: toda ação de admin, moderador ou RH grava `audit_logs`.
 *
 * Sem `server-only`: este módulo não lê segredo e não abre conexão — recebe a
 * transação de quem já a tem. Marcá-lo travaria o teste que exercita a
 * auditoria junto da operação, sem proteger nada que já não esteja protegido
 * por `lib/db` e `lib/supabase/admin`.
 *
 * Recebe a transação, não a conexão. Gravar depois, fora da transação, deixaria
 * a porta aberta para a operação acontecer e o registro não — e um livro-caixa
 * com lançamento sem autor é um livro-caixa que não serve de prova. Se a
 * auditoria falhar, a operação inteira volta atrás.
 *
 * `before` e `after` guardam o estado, não a intenção: é o que permite
 * reconstruir o que mudou meses depois, quando ninguém lembra do formulário.
 */
export type Auditoria = {
  ator: { id: string; role: Role };
  /** Empresa afetada, quando a ação é de uma. Ação de plataforma vai sem. */
  orgId?: string | null;
  /** Verbo no infinitivo, com o objeto: `criar_empresa`, `alocar_fichas`. */
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
};

export async function registrarAuditoria(
  tx: postgres.TransactionSql | postgres.Sql,
  evento: Auditoria,
): Promise<void> {
  await tx`
    insert into audit_logs (actor_id, actor_role, org_id, action, entity, entity_id, before, after)
    values (
      ${evento.ator.id},
      ${evento.ator.role}::user_role,
      ${evento.orgId ?? null},
      ${evento.acao},
      ${evento.entidade},
      ${evento.entidadeId ?? null},
      ${paraJsonb(evento.antes)}::text::jsonb,
      ${paraJsonb(evento.depois)}::text::jsonb
    )`;
}
