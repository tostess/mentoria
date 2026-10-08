import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { DURACAO_DA_SESSAO_MIN } from "@/lib/config/limites";
import { dataHora, dia, quandoRelativo } from "@/lib/formato";
import { fichasUsadas } from "@/lib/ledger/uso";
import { deOndeVemAFicha, quemVe, regraDaFicha, validadeDaFicha } from "@/lib/profissional/conta";
import { carregarCarteira, carregarExtrato, carregarValidades } from "@/lib/profissional/dados";
import { cap, countFichas } from "@/lib/terms";

export const metadata = { title: "Minhas fichas" };

/**
 * A carteira do Profissional — o primeiro lugar do produto em que ele vê o
 * próprio dinheiro.
 *
 * Duas coisas têm de ficar claras numa olhada: quantas fichas ele tem e de onde
 * vieram. O extrato existe por isso: saldo sem histórico obriga a pessoa a
 * confiar no número, e ficha é a moeda com que ela paga uma conversa que
 * importa.
 */
export default async function Page() {
  const sessao = await requireRole("professional");
  const config = await loadAppConfig();
  const t = config.terms;

  const carteira = await carregarCarteira(sessao.userId);

  if (carteira === null) {
    return (
      <>
        <PageHeader eyebrow={t.professional} title={`Minhas ${t.fichas}`} />
        <EmptyState
          title="Você ainda não tem carteira"
          description={
            sessao.tipoDeConta === "pessoal"
              ? "Fale com a operadora para ativar a sua carteira."
              : `Fale com o ${t.orgAdmin} da sua empresa para receber ${t.fichas}.`
          }
        />
      </>
    );
  }

  const extrato = await carregarExtrato(sessao.userId);
  const usadas = fichasUsadas(extrato);

  // Só a conta pessoal tem ficha com validade. Na de empresa nem se pergunta.
  const pessoal = sessao.tipoDeConta === "pessoal";
  const validades = pessoal ? await carregarValidades(sessao.userId) : [];
  const meses = config.individualPolicy.validadeMeses;

  return (
    <>
      <PageHeader
        eyebrow={t.professional}
        title={`Minhas ${t.fichas}`}
        description={`Cada ${t.ficha} vale uma ${t.session} de ${DURACAO_DA_SESSAO_MIN} minutos com um ${t.partner}.`}
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-[18px]">
          <Card>
            <div className="flex items-center gap-4">
              {carteira.saldo > 0 ? (
                <FichaStack count={carteira.saldo} max={pessoal ? 6 : config.fichaPolicy.maxBalance} />
              ) : (
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-dashed border-line2 text-faint">
                  <Icone nome="coins" tamanho={18} />
                </span>
              )}
              <div>
                <div className="font-display text-[44px] font-bold leading-[0.9]">
                  {carteira.saldo}
                </div>
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-stone">
                  {cap(t.fichas)} disponíveis
                </div>
              </div>
            </div>

            {carteira.saldo === 0 && (
              <p className="mt-4 border-t border-line pt-4 text-[13px] leading-[1.5] text-stone">
                {pessoal
                  ? `Sua carteira está vazia. ${deOndeVemAFicha(sessao.tipoDeConta, t)}`
                  : `Sua carteira está vazia. O ${t.orgAdmin} da sua empresa distribui as ${t.fichas}, e elas também são recarregadas no começo de cada mês.`}
              </p>
            )}

            {validades.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4">
                {validades.map((validade) => (
                  <li
                    key={validade.venceEm.toISOString()}
                    className="flex items-center justify-between gap-3 text-[13px]"
                  >
                    <span>{countFichas(validade.restante, t)}</span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-stone">
                      <Icone nome="calendar-clock" tamanho={12} />
                      {validade.venceEm <= new Date()
                        ? `vencem em ${dia(validade.venceEm)}`
                        : `valem até ${dia(validade.venceEm)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Como a ${t.ficha} funciona`}>
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <Linha
                rotulo={`Custo de uma ${t.session}`}
                valor={countFichas(config.fichaPolicy.price30, t)}
              />
              {!pessoal && (
                <Linha
                  rotulo="Teto da carteira"
                  valor={countFichas(config.fichaPolicy.maxBalance, t)}
                />
              )}
              <Linha
                rotulo="Validade"
                valor={validadeDaFicha(sessao.tipoDeConta, meses, config.fichaPolicy.expires)}
              />
              <Linha rotulo={`Já usadas`} valor={countFichas(usadas, t)} />
            </dl>
            <p className="mt-3 text-[12px] leading-[1.45] text-stone">
              {regraDaFicha(sessao.tipoDeConta, meses, t)}
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card
            title="Extrato"
            action={
              carteira.ultimoUso !== null ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone">
                  Último uso {quandoRelativo(carteira.ultimoUso)}
                </span>
              ) : undefined
            }
          >
            {extrato.length === 0 ? (
              <EmptyState
                title="Nada movimentou ainda"
                description={
                  pessoal
                    ? `Quando um pacote for pago, o lançamento aparece aqui.`
                    : `Quando o ${t.orgAdmin} alocar ${t.fichas} para você, o lançamento aparece aqui.`
                }
              />
            ) : (
              <ul className="flex flex-col">
                {extrato.map((lancamento) => (
                  <li
                    key={lancamento.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0"
                  >
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-mist text-stone">
                      <Icone nome={lancamento.icone} tamanho={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold">
                        {lancamento.rotulo}
                      </div>
                      <div className="truncate text-[12px] text-stone">
                        {lancamento.motivo ?? dataHora(lancamento.quando)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-[14px] font-semibold tabular-nums ${
                          lancamento.quantidade > 0 ? "text-success" : "text-ink"
                        }`}
                      >
                        {lancamento.quantidade > 0 ? "+" : "−"}
                        {Math.abs(lancamento.quantidade)}
                      </div>
                      <div className="font-mono text-[10px] text-faint">
                        saldo {lancamento.saldoDepois}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Note>
            <div>{quemVe(sessao.tipoDeConta, t)}</div>
          </Note>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <dt className="text-stone">{rotulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  );
}
