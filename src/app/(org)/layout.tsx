import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth/session";

export default async function OrgLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("org_admin");
  return (
    <AppShell shell="org" session={session}>
      {children}
    </AppShell>
  );
}
