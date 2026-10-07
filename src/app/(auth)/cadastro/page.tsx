import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { loadAppConfig, loadTheme } from "@/lib/config/load";
import { hasSupabasePublicEnv } from "@/lib/env";
import { reais } from "@/lib/formato";
import { cap } from "@/lib/terms";
import { CadastroForm } from "./CadastroForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Criar ${(await loadAppConfig()).terms.individual.toLowerCase()}` };
}

/**
 * O cadastro self-service do Profissional avulso (A3) — a única porta de
 * entrada que não passa pela operadora antes. Passa depois: o pedido só vira
 * conta quando ela aprova, em `/admin/cadastros`.
 *
 * Vocabulário e marca são os da plataforma, como na entrada: quem chega aqui
 * não tem empresa.
 */
export default async function Page() {
  const config = await loadAppConfig();
  const t = config.terms;
  const { accent } = await loadTheme(null);

  if (!hasSupabasePublicEnv) {
    return (
      <Card className="w-full max-w-[400px]">
        <h1 className="text-[33px]">Cadastro indisponível</h1>
        <p className="mt-1 text-[13px] text-[#8E7C86]">
          Este ambiente está sem a configuração de acesso. A tela de entrada diz o que falta.
        </p>
      </Card>
    );
  }

  const ativos = config.pacotes.filter((p) => p.ativo);
  const menorPreco = ativos.length === 0 ? null : Math.min(...ativos.map((p) => p.precoCentavos));
  const conta = t.individual.toLowerCase();

  const passos = [
    "Você preenche o pedido e confirma o e-mail.",
    `A ${t.admin.toLowerCase()} confere o pedido e abre a sua ${conta}.`,
    `Você entra, escolhe um pacote de ${t.fichas} e marca a primeira ${t.session} com um ${t.partner}.`,
  ];

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <Card>
        <h1 className="text-[33px]">Criar {conta}</h1>
        <p className="mt-1 text-[13px] leading-[1.5] text-[#8E7C86]">
          Para quem busca mentoria por conta própria, sem empresa por trás. Cada {t.ficha} vale uma{" "}
          {t.session} de 30 minutos com um {t.partnerLong}
          {menorPreco === null ? "." : `, e os pacotes começam em ${reais(menorPreco)}.`}
        </p>

        <ol className="mb-5 mt-4 flex flex-col gap-2 border-y border-[#F3E4EC] py-3.5">
          {passos.map((passo, i) => (
            <li key={passo} className="flex gap-2.5 text-[13px] leading-[1.45] text-[#2A1B26]">
              <span className="w-4 shrink-0 font-mono text-[11px] leading-[19px] text-[#8E7C86]">
                {i + 1}
              </span>
              {passo}
            </li>
          ))}
        </ol>

        <CadastroForm
          termoConta={cap(conta)}
          termosUrl={config.legal.termsUrl}
          privacidadeUrl={config.legal.privacyUrl}
        />
      </Card>

      <p className="text-center text-[13px] text-[#8E7C86]">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold hover:underline" style={{ color: accent }}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
