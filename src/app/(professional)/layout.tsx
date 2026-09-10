import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function ProfessionalLayout({ children }: { children: ReactNode }) {
  return <AppShell shell="professional">{children}</AppShell>;
}
