import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function OrgLayout({ children }: { children: ReactNode }) {
  return <AppShell shell="org">{children}</AppShell>;
}
