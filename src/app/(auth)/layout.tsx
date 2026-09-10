import type { ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Brand sub="Acesso" />
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
