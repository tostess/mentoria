import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <AppShell shell="partner">{children}</AppShell>;
}
