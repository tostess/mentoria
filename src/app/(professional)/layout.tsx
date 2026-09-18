import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth/session";

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("professional");
  return (
    <AppShell shell="professional" session={session}>
      {children}
    </AppShell>
  );
}
