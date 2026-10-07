import type { ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";

/** Cada página escolhe a própria largura: a entrada é estreita, o cadastro tem mais campos. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand sub="Acesso" />
      <div className="flex w-full justify-center">{children}</div>
    </div>
  );
}
