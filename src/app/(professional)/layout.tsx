import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth/session";
import { carregarCarteira } from "@/lib/profissional/dados";

/**
 * O saldo é lido aqui, e não dentro da sidebar.
 *
 * A sidebar renderiza em paralelo com a página, então uma consulta lá seria
 * concorrente com as da tela — e consulta Drizzle concorrente entala a conexão
 * de `max: 1`. Esta leitura é segura por dois motivos: vai por PostgREST (HTTP,
 * não pelo pool) e acontece no layout, antes de os filhos renderizarem.
 */
export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("professional");
  const carteira = await carregarCarteira(session.userId);

  return (
    <AppShell shell="professional" session={session} saldo={carteira?.saldo ?? null}>
      {children}
    </AppShell>
  );
}
