import { Card } from "@/components/ui/Card";
import { Note } from "@/components/ui/Note";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, hasSupabasePublicEnv } from "@/lib/env";
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

  /**
   * Ambiente sem Supabase: a tela diz o que falta, em vez de oferecer um
   * formulário que não tem para onde enviar.
   *
   * Só presença, nunca valor — a chave publishable vai ao navegador de qualquer
   * forma, mas exibir segredo por engano começa assim. Quem vê isto é quem
   * acabou de subir o deploy, e a pergunta dele é "qual variável faltou".
   */
  if (!hasSupabasePublicEnv) {
    return (
      <Card>
        <h1 className="text-[33px]">Ambiente incompleto</h1>
        <p className="mb-5 mt-1 text-[13px] text-[#8E7C86]">
          A entrada não pode funcionar sem a configuração do Supabase.
        </p>
        <Note variant="gold">
          <div>
            <p className="font-semibold">Falta configurar:</p>
            <ul className="mt-1.5 flex flex-col gap-1 font-mono text-[12px]">
              {SUPABASE_URL === "" && <li>NEXT_PUBLIC_SUPABASE_URL</li>}
              {SUPABASE_PUBLISHABLE_KEY === "" && <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>}
            </ul>
            <p className="mt-2.5 text-[12px] leading-[1.45]">
              Variável <span className="font-mono">NEXT_PUBLIC_</span> é embutida no bundle em tempo
              de build: cadastrar no painel não basta, é preciso um novo deploy. Em{" "}
              <span className="font-mono">/api/health</span> dá para conferir todas de uma vez.
            </p>
          </div>
        </Note>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-[33px]">Entrar</h1>
      <p className="mb-5 mt-1 text-[13px] text-[#8E7C86]">Use o e-mail cadastrado pela sua empresa.</p>
      <EntrarForm next={next} aviso={AVISOS[chave] ?? null} />
    </Card>
  );
}
