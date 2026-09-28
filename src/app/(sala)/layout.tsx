import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";

/**
 * A sala fica fora da casca com sidebar: o vídeo precisa da tela inteira, e no
 * celular não cabem navegação e chamada juntas. Os dois lados da sessão entram
 * aqui; quem é participante de qual sessão, a página confere.
 */
export default async function SalaLayout({ children }: { children: ReactNode }) {
  await requireRole("professional", "partner");
  return <>{children}</>;
}
