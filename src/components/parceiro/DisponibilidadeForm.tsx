"use client";

import { useActionState, useState } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { CONTROLE_MONO, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { onSoft, withAlpha } from "@/lib/theme";
import { limparDisponibilidadeAcao, salvarDisponibilidadeAcao } from "@/lib/parceiro/acoes";
import { DIAS, cabemPorSemana, paraMinutos, resumoDaRotina } from "@/lib/parceiro/horarios";
import { FORM_INICIAL } from "@/lib/forms";
import type { DiaDaSemana } from "@/lib/scheduling";

/**
 * Modo rápido: um intervalo, os dias que o Parceiro escolher, toda semana.
 *
 * O resumo embaixo é atualizado enquanto ele mexe, antes de salvar. Não é
 * enfeite: "Ter e Qui, das 09:00 às 12:00 — até 12 sessões por semana" é a
 * frase que faz ele perceber que abriu mais do que queria, e o teto semanal
 * dele aparece ao lado para a comparação ser imediata.
 */
export function DisponibilidadeForm({
  diasIniciais,
  inicioInicial,
  fimInicial,
  maxPorSemana,
  duracaoMin,
}: {
  diasIniciais: readonly DiaDaSemana[];
  inicioInicial: string;
  fimInicial: string;
  maxPorSemana: number;
  duracaoMin: number;
}) {
  const [estado, acao, enviando] = useActionState(salvarDisponibilidadeAcao, FORM_INICIAL);
  const [limpeza, acaoLimpar, limpando] = useActionState(limparDisponibilidadeAcao, FORM_INICIAL);
  const theme = useTheme();

  const [dias, setDias] = useState<DiaDaSemana[]>([...diasIniciais]);
  const [inicio, setInicio] = useState(inicioInicial);
  const [fim, setFim] = useState(fimInicial);

  function alternar(dia: DiaDaSemana) {
    setDias((atuais) =>
      atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia],
    );
  }

  const previa = calcularPrevia(dias, inicio, fim, duracaoMin);

  return (
    <div className="flex flex-col gap-4">
      <form action={acao} className="flex flex-col gap-4">
        <FormFeedback
          erro={estado.erro ?? limpeza.erro}
          ok={estado.ok ?? limpeza.ok}
          credencial={null}
        />

        <fieldset>
          <legend className="mb-2 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]">
            Dias que você atende
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map((dia) => {
              const ativo = dias.includes(dia.valor);
              return (
                <label
                  key={dia.valor}
                  className={`cursor-pointer select-none rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
                    ativo ? "border-transparent" : "border-[#EAD6E1] bg-white text-[#8E7C86]"
                  }`}
                  style={
                    ativo
                      ? {
                          backgroundColor: withAlpha(theme.accent, 0.12),
                          color: onSoft(theme.accent),
                        }
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    name="dias"
                    value={dia.valor}
                    checked={ativo}
                    disabled={enviando || limpando}
                    onChange={() => alternar(dia.valor)}
                    className="sr-only"
                  />
                  <span aria-hidden="true">{dia.curto}</span>
                  <span className="sr-only">{dia.longo}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field htmlFor="inicio" label="Das">
            <input
              id="inicio"
              name="inicio"
              type="time"
              step={900}
              required
              value={inicio}
              disabled={enviando || limpando}
              onChange={(evento) => setInicio(evento.target.value)}
              className={CONTROLE_MONO}
            />
          </Field>
          <Field htmlFor="fim" label="Às">
            <input
              id="fim"
              name="fim"
              type="time"
              step={900}
              required
              value={fim}
              disabled={enviando || limpando}
              onChange={(evento) => setFim(evento.target.value)}
              className={CONTROLE_MONO}
            />
          </Field>
        </div>

        <div className="rounded-[12px] bg-[#FDF8FB] px-[15px] py-[13px]">
          <p className="text-[13px] leading-[1.5] text-[#2A1B26]">{previa.resumo}</p>
          {previa.cabem > 0 && (
            <p className="mt-1 text-[12px] leading-[1.45] text-[#8E7C86]">
              Cabem até {previa.cabem} sessões por semana na janela, mas o seu teto é{" "}
              <strong className="font-semibold text-[#2A1B26]">{maxPorSemana}</strong> — é ele que
              vale.
            </p>
          )}
        </div>

        <Button type="submit" disabled={enviando || limpando || dias.length === 0}>
          {enviando ? "Salvando…" : "Salvar disponibilidade"}
        </Button>
      </form>

      {diasIniciais.length > 0 && (
        <form action={acaoLimpar}>
          <button
            type="submit"
            disabled={enviando || limpando}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#BFAFB8] transition-colors hover:text-[#A63A2E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {limpando ? "Apagando…" : "Apagar minha rotina"}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * O resumo é calculado no cliente enquanto a pessoa mexe, então precisa
 * aguentar estado intermediário: campo de hora meio digitado, fim antes do
 * início. Nada disso é erro — é alguém no meio de uma frase.
 */
function calcularPrevia(
  dias: readonly DiaDaSemana[],
  inicio: string,
  fim: string,
  duracaoMin: number,
): { resumo: string; cabem: number } {
  if (dias.length === 0) {
    return { resumo: "Escolha ao menos um dia para aparecer na busca.", cabem: 0 };
  }
  try {
    const inicioMin = paraMinutos(inicio);
    const fimMin = paraMinutos(fim);
    if (fimMin <= inicioMin) {
      return { resumo: "O término precisa ser depois do início.", cabem: 0 };
    }
    return {
      resumo: resumoDaRotina(dias, inicioMin, fimMin),
      cabem: cabemPorSemana(dias.length, inicioMin, fimMin, duracaoMin),
    };
  } catch {
    return { resumo: "Preencha os dois horários.", cabem: 0 };
  }
}
