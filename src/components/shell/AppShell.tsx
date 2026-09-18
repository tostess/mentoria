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
  children,
}: {
  shell: Shell;
  session: Session;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[246px_1fr]">
      <Sidebar shell={shell} session={session} />
      <main className="w-full max-w-[1140px] px-[18px] pb-[60px] pt-6 lg:px-10 lg:pb-[70px] lg:pt-[34px]">
        {children}
      </main>
    </div>
  );
}
