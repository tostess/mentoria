import { Card } from "@/components/ui/Card";
import { EntrarForm } from "./EntrarForm";

/**
 * Entrada por e-mail e senha. No piloto a conta é criada pelo admin — não há
 * cadastro, nem recuperação self-service, nem login social: o Parceiro entra
 * por convite (invariante 8) e o Profissional é selecionado pelo RH.
 */
const AVISOS: Record<string, string> = {
  "sem-acesso": "Seu acesso está inativo. Fale com quem administra sua conta.",
};

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  const chave = typeof params.erro === "string" ? params.erro : "";

  return (
    <Card>
      <h1 className="text-[33px]">Entrar</h1>
      <p className="mb-5 mt-1 text-[13px] text-[#8E7C86]">Use o e-mail cadastrado pela sua empresa.</p>
      <EntrarForm next={next} aviso={AVISOS[chave] ?? null} />
    </Card>
  );
}
