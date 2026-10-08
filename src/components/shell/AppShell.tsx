import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import type { Session } from "@/lib/auth/claims";
import type { Shell } from "@/lib/roles";

/**
 * Casca comum aos papéis autenticados: sidebar branca de 246px + área principal.
 * Abaixo de 1024px a sidebar vai para cima e deixa de ser fixa.
 */
export function AppShell({
  shell,
  session,
  saldo,
  children,
}: {
  shell: Shell;
  session: Session;
  /** Saldo da carteira, quando a casca tem um para mostrar (Profissional). */
  saldo?: number | null;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 max-lg:content-start lg:grid-cols-[246px_1fr]">
      <Sidebar shell={shell} session={session} saldo={saldo} />
      <main className="w-full max-w-[1140px] px-[18px] pb-[60px] pt-6 lg:px-10 lg:pb-[70px] lg:pt-[34px]">
        {children}
      </main>
    </div>
  );
}
