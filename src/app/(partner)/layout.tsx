import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth/session";

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("partner");
  return (
    <AppShell shell="partner" session={session}>
      {children}
    </AppShell>
  );
}
