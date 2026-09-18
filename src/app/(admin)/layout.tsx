import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth/session";

/** Operadora e delegado dela dividem a casca; o recorte do moderador é por tela. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("admin", "moderator");
  return (
    <AppShell shell="admin" session={session}>
      {children}
    </AppShell>
  );
}
