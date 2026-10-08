"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE_MONO, ROTULO } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { salvarGradeAcao } from "@/lib/parceiro/acoes";
import { MAX_FAIXAS_POR_DIA, lerGrade, validarGrade } from "@/lib/parceiro/grade";
import { DIAS, paraMinutos, paraTexto } from "@/lib/parceiro/horarios";
import type { DiaDaSemana } from "@/lib/scheduling";

/** Uma faixa como o formulário a edita: texto `HH:MM`, que é o que o `<input type="time">` fala. */
export type FaixaEditavel = { dia: DiaDaSemana; inicio: string; fim: string };

type Linha = FaixaEditavel & { chave: number };

let proximaChave = 0;
const comChave = (faixa: FaixaEditavel): Linha => ({ ...faixa, chave: (proximaChave += 1) });

/**
 * A rotina da semana, dia por dia, com quantas faixas o Parceiro quiser.
 *
 * Nada é salvo até ele clicar em "Salvar rotina": a grade inteira vai num campo
 * só e substitui a anterior. O atalho "os mesmos horários em vários dias" — o
 * antigo modo rápido — só preenche a grade aqui no cliente, então não há mais
 * caminho que sobrescreva sem ele ver o resultado.
 *
 * A validação roda aqui também, com a mesma função do servidor, para o erro
 * aparecer enquanto ele digita e não depois do clique.
 */
export function GradeSemanal({
  inicial,
  maxPorSemana,
  duracaoMin,
}: {
  inicial: readonly FaixaEditavel[];
  maxPorSemana: number;
  duracaoMin: number;
}) {
  // Por `onSubmit`, sem o reset do React 19 depois da ação: os campos são
  // controlados e o reset os poria fora de sincronia com o estado.
  const [estado, aoEnviar, salvando] = useEnvioSemReset(salvarGradeAcao);
  const [linhas, setLinhas] = useState<Linha[]>(() => inicial.map(comChave));
  // O que está salvo é o que o servidor mandou: depois do `refresh()` da ação a
  // prop chega nova, e "mudou" volta a falso sozinho — e só se a gravação deu certo.
  const salva = serializar(inicial);

  const serializada = serializar(linhas);
  const mudou = serializada !== salva;
  const analise = analisar(serializada, duracaoMin);

  function trocar(chave: number, campo: "inicio" | "fim", valor: string) {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  }

  function remover(chave: number) {
    setLinhas((atuais) => atuais.filter((l) => l.chave !== chave));
  }

  function acrescentar(dia: DiaDaSemana) {
    setLinhas((atuais) => {
      const doDia = atuais.filter((l) => l.dia === dia);
      // A nova faixa começa onde a última termina, para não nascer sobreposta.
      const ultima = doDia[doDia.length - 1];
      const nova = ultima === undefined ? { inicio: "09:00", fim: "12:00" } : depoisDe(ultima.fim);
      return [...atuais, comChave({ dia, ...nova })];
    });
  }

  function aplicar(dias: readonly DiaDaSemana[], inicio: string, fim: string) {
    setLinhas((atuais) => [
      ...atuais.filter((l) => !dias.includes(l.dia)),
      ...dias.map((dia) => comChave({ dia, inicio, fim })),
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={aoEnviar}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="grade" value={serializada} />
        <FormFeedback erro={estado.erro} ok={mudou ? null : estado.ok} credencial={null} />

        <ul className="flex flex-col divide-y divide-line rounded-[12px] border border-line">
          {DIAS.map(({ valor, curto, longo }) => {
            const doDia = linhas.filter((l) => l.dia === valor);
            return (
              <li
                key={valor}
                className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="flex items-center justify-between sm:w-[52px] sm:shrink-0 sm:pt-2">
                  <span
                    className={`text-[13.5px] font-semibold ${doDia.length === 0 ? "text-faint" : "text-ink"}`}
                  >
                    <span aria-hidden="true">{curto}</span>
                    <span className="sr-only">{longo}</span>
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {doDia.length === 0 && (
                    <span className="pt-0.5 text-[13px] text-faint sm:pt-2">Não atende</span>
                  )}
                  {doDia.map((linha, i) => (
                    <div key={linha.chave} className="flex items-center gap-2">
                      <div className="w-[112px] shrink-0">
                        <input
                          type="time"
                          step={900}
                          required
                          aria-label={`${longo}, início da faixa ${i + 1}`}
                          value={linha.inicio}
                          disabled={salvando}
                          onChange={(e) => trocar(linha.chave, "inicio", e.target.value)}
                          className={CONTROLE_MONO}
                        />
                      </div>
                      <span className="text-faint">–</span>
                      <div className="w-[112px] shrink-0">
                        <input
                          type="time"
                          step={900}
                          required
                          aria-label={`${longo}, término da faixa ${i + 1}`}
                          value={linha.fim}
                          disabled={salvando}
                          onChange={(e) => trocar(linha.chave, "fim", e.target.value)}
                          className={CONTROLE_MONO}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remover(linha.chave)}
                        disabled={salvando}
                        aria-label={`Remover faixa ${i + 1} de ${longo}`}
                        className="rounded-[8px] p-1.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <Icone nome="x" tamanho={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {doDia.length < MAX_FAIXAS_POR_DIA && (
                  <button
                    type="button"
                    onClick={() => acrescentar(valor)}
                    disabled={salvando}
                    className="inline-flex items-center gap-1 self-start rounded-[8px] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-stone transition-colors hover:bg-blush hover:text-ink disabled:opacity-50 sm:mt-1"
                  >
                    <Icone nome="plus" tamanho={13} />
                    {doDia.length === 0 ? "Abrir" : "Faixa"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="rounded-[12px] bg-mist px-[15px] py-[13px]">
          {analise.erro !== null ? (
            <p className="text-[13px] leading-[1.5] text-danger">{analise.erro}</p>
          ) : analise.cabem === 0 ? (
            <p className="text-[13px] leading-[1.5] text-ink">
              Nenhum dia aberto — salvar assim tira você da busca até abrir algum.
            </p>
          ) : (
            <p className="text-[13px] leading-[1.5] text-ink">
              Cabem até {analise.cabem} sessões por semana na grade, mas o seu teto é{" "}
              <strong className="font-semibold">{maxPorSemana}</strong> — é ele que vale.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={salvando || analise.erro !== null || !mudou}>
            {salvando ? "Salvando…" : "Salvar rotina"}
          </Button>
          {mudou && !salvando && (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                Alterações não salvas
              </span>
              <button
                type="button"
                onClick={() => setLinhas(inicial.map(comChave))}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-stone hover:text-ink"
              >
                Desfazer
              </button>
            </>
          )}
        </div>
      </form>

      <Atalho aoAplicar={aplicar} desabilitado={salvando} />
    </div>
  );
}

/**
 * O antigo modo rápido, agora como atalho: escolhe dias e um horário, e a
 * grade acima troca o que havia nesses dias por essa faixa. Não salva.
 */
function Atalho({
  aoAplicar,
  desabilitado,
}: {
  aoAplicar: (dias: readonly DiaDaSemana[], inicio: string, fim: string) => void;
  desabilitado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState<DiaDaSemana[]>([1, 2, 3, 4, 5]);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("12:00");

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start font-mono text-[10px] uppercase tracking-[0.12em] text-stone hover:text-ink"
      >
        Mesmo horário em vários dias
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-dashed border-line2 px-3.5 py-3">
      <p className="text-[12.5px] leading-[1.45] text-stone">
        Troca o que estiver na grade nos dias escolhidos por esta faixa. Nada é salvo até você clicar
        em “Salvar rotina”.
      </p>
      <fieldset>
        <legend className={ROTULO}>Dias</legend>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((dia) => {
            const ativo = dias.includes(dia.valor);
            return (
              <label
                key={dia.valor}
                className={`cursor-pointer select-none rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  ativo ? "border-transparent bg-accent-12 text-on-soft" : "border-line2 bg-surface text-stone"
                }`}
              >
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() =>
                    setDias((atuais) =>
                      atuais.includes(dia.valor)
                        ? atuais.filter((d) => d !== dia.valor)
                        : [...atuais, dia.valor],
                    )
                  }
                  className="sr-only"
                />
                <span aria-hidden="true">{dia.curto}</span>
                <span className="sr-only">{dia.longo}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[112px] shrink-0">
          <input
            type="time"
            step={900}
            aria-label="Início"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={CONTROLE_MONO}
          />
        </div>
        <span className="text-faint">–</span>
        <div className="w-[112px] shrink-0">
          <input
            type="time"
            step={900}
            aria-label="Término"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className={CONTROLE_MONO}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={desabilitado || dias.length === 0 || inicio === "" || fim === ""}
          onClick={() => {
            aoAplicar(dias, inicio, fim);
            setAberto(false);
          }}
        >
          Aplicar na grade
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

/** A grade como o servidor a recebe — e como se compara "mudou ou não". */
function serializar(faixas: readonly FaixaEditavel[]): string {
  return JSON.stringify(
    [...faixas]
      .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
      .map(({ dia, inicio, fim }) => ({ dia, inicio, fim })),
  );
}

/**
 * A mesma validação do servidor, rodando enquanto a pessoa mexe. Campo meio
 * digitado não é erro de verdade, mas impede salvar — e a frase diz por quê.
 */
function analisar(serializada: string, duracaoMin: number): { erro: string | null; cabem: number } {
  try {
    const grade = validarGrade(lerGrade(serializada), duracaoMin);
    const cabem = grade.reduce(
      (soma, f) => soma + Math.floor((f.fimMin - f.inicioMin) / duracaoMin),
      0,
    );
    return { erro: null, cabem };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Confira os horários.", cabem: 0 };
  }
}

/** Uma faixa de 1h logo depois de `fim`, sem passar da meia-noite. */
function depoisDe(fim: string): { inicio: string; fim: string } {
  let inicioMin = 14 * 60;
  try {
    inicioMin = paraMinutos(fim);
  } catch {
    // Campo meio digitado: começa à tarde, e a pessoa ajusta.
  }
  inicioMin = Math.min(inicioMin, 22 * 60);
  const fimMin = Math.min(inicioMin + 60, 23 * 60 + 45);
  return { inicio: paraTexto(inicioMin), fim: paraTexto(fimMin) };
}
