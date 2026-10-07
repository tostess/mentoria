import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { loadTerms } from "@/lib/config/load";
import { Confirmacao } from "./Confirmacao";

export const metadata: Metadata = { title: "E-mail confirmado" };

/**
 * Onde o link de confirmação do cadastro chega.
 *
 * O link passa antes pelo servidor de auth, que confirma o e-mail e só depois
 * redireciona para cá — então chegar aqui sem erro já é a confirmação feita. A
 * página não abre sessão: sem perfil não haveria papel, e uma sessão sem papel
 * só levaria a pessoa a uma tela de "acesso inativo".
 *
 * O erro chega na query (fluxo PKCE) ou no fragmento (fluxo implícito, que é o
 * do `signUp` sem cookie). O fragmento o servidor não vê; quem lê é o
 * componente de cliente.
 */
export default async function Page({ searchParams }: PageProps<"/cadastro/confirmado">) {
  const params = await searchParams;
  const erroNaQuery = typeof params.error_code === "string" || typeof params.error === "string";
  const t = await loadTerms();

  return (
    <Card className="w-full max-w-[440px]">
      <Confirmacao erroNaQuery={erroNaQuery} termoAdmin={t.admin} />
    </Card>
  );
}
