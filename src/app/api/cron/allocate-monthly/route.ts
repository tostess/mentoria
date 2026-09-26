import { autorizarCron } from "@/lib/cron/guarda";
import { loadAppConfig } from "@/lib/config/load";
import { alocarMesTodo } from "@/lib/ledger";

/**
 * `allocate-monthly` — a recarga do dia 1º.
 *
 * `GET` porque é o que a Vercel Cron dispara. Não é leitura: escreve nos dois
 * livros-caixa. Isso seria um problema se algo pudesse repetir a chamada por
 * engano — um prefetch, um retry de proxy —, e é justamente por isso que a
 * invariante 16 existe: a segunda chamada do mês colide na `idempotency_key` e
 * não duplica nada. O método é da Vercel; a segurança é da chave.
 *
 * Route Handler e não Server Action porque quem chama não é tela nenhuma. A
 * transação em si mora em `lib/ledger` e é a **mesma** que a operadora usa para
 * alocar à mão — o que muda é a chave e o autor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uma alocação por pessoa, sequencial. Com dezenas de colaboradores no piloto
 * isso cabe folgado no teto de execução; quando não couber, a saída é paginar por
 * empresa e não paralelizar — a conexão de runtime é `max: 1`.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const recusa = autorizarCron(request);
  if (recusa !== null) return recusa;

  const comecou = Date.now();

  try {
    const { fichaPolicy } = await loadAppConfig();
    const resultado = await alocarMesTodo({ agora: new Date(), fichaPolicy });

    const houveErro = resultado.empresas.some((e) => e.erros.length > 0);
    console.log(
      `[allocate-monthly] ${resultado.periodo}: ${resultado.totalPessoas} pessoas, ` +
        `${resultado.totalFichas} fichas, ${Date.now() - comecou}ms`,
    );

    // 207 quando parte falhou: a rodada aconteceu e o painel da Vercel precisa
    // mostrar que algo pede atenção, sem marcar como perdida uma execução que
    // recarregou quase todo mundo.
    return Response.json(
      { ok: !houveErro, ms: Date.now() - comecou, ...resultado },
      { status: houveErro ? 207 : 200, headers: { "cache-control": "no-store" } },
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[allocate-monthly] rodada abortada:", mensagem);
    return Response.json(
      { ok: false, erro: "rodada abortada" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
