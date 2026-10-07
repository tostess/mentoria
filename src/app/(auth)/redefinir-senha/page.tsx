import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { NovaSenha } from "./NovaSenha";

export const metadata: Metadata = { title: "Senha nova" };

/**
 * Onde o link de recuperação chega. Os tokens vêm no fragmento do endereço,
 * que o servidor não vê: quem lê é o componente de cliente, que os apaga da
 * barra e os manda junto com a senha nova. Aberta com ou sem sessão — ver
 * `OPEN_PREFIXES` em `lib/auth/routes.ts`.
 */
export default function Page() {
  return (
    <Card className="w-full max-w-[400px]">
      <NovaSenha />
    </Card>
  );
}
