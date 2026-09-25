"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FORM_INICIAL, type FormState } from "@/lib/forms";
import { Button, type ButtonVariant } from "./Button";
import { FormFeedback } from "./FormFeedback";
import { Icone } from "./Icone";
import type { NomeIcone } from "./icones";

export type OpcaoConfirmada = {
  /** Valor enviado no campo `campo` quando esta opção é escolhida. */
  valor: string;
  rotulo: string;
  icone: NomeIcone;
  variante?: ButtonVariant;
  /**
   * A pergunta do segundo passo. Sem ela, o botão envia direto — reativar
   * alguém não precisa de "tem certeza?", arquivar precisa.
   */
  pergunta?: string;
  /** Texto do botão que confirma. Default: o próprio rótulo. */
  confirmar?: string;
};

/**
 * Botões de ação que podem pedir confirmação antes de enviar.
 *
 * Um formulário só, com um retorno só, para todas as opções. Não é detalhe: o
 * conjunto de botões muda depois do sucesso (quem pausou passa a ver
 * "Reativar"), e um formulário por botão desmontaria junto com o botão —
 * levando embora a mensagem que diz o que acabou de acontecer.
 *
 * A confirmação é inline, não modal. O primeiro clique troca os botões pela
 * pergunta, com "Cancelar" já focado para que Enter distraído não confirme;
 * `Esc` volta.
 */
export function AcoesConfirmadas({
  acao,
  campo,
  ocultos,
  opcoes,
}: {
  acao: (anterior: FormState, form: FormData) => Promise<FormState>;
  campo: string;
  ocultos: Record<string, string>;
  opcoes: OpcaoConfirmada[];
}) {
  const [estado, enviar, enviando] = useActionState(acao, FORM_INICIAL);
  const [pendente, setPendente] = useState<string | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  const escolhida = opcoes.find((o) => o.valor === pendente) ?? null;

  useEffect(() => {
    if (escolhida !== null) cancelar.current?.focus();
  }, [escolhida]);

  return (
    <form
      action={(form) => {
        setPendente(null);
        enviar(form);
      }}
      className="flex flex-col gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape" && pendente !== null) setPendente(null);
      }}
    >
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}

      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      {escolhida !== null && escolhida.pergunta !== undefined ? (
        <div
          role="group"
          aria-label="Confirmação"
          className="flex flex-col gap-2.5 rounded-[12px] bg-[#FBEAE7] px-3.5 py-3"
        >
          <p className="text-[13px] leading-[1.5] text-[#A63A2E]">{escolhida.pergunta}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name={campo}
              value={escolhida.valor}
              variant="warn"
              size="sm"
              disabled={enviando}
            >
              <Icone nome={escolhida.icone} tamanho={14} />
              {escolhida.confirmar ?? escolhida.rotulo}
            </Button>
            <Button
              ref={cancelar}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPendente(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((opcao) =>
            opcao.pergunta === undefined ? (
              <Button
                key={opcao.valor}
                type="submit"
                name={campo}
                value={opcao.valor}
                variant={opcao.variante ?? "ghost"}
                size="sm"
                disabled={enviando}
              >
                <Icone nome={opcao.icone} tamanho={14} />
                {opcao.rotulo}
              </Button>
            ) : (
              <Button
                key={opcao.valor}
                type="button"
                variant={opcao.variante ?? "ghost"}
                size="sm"
                disabled={enviando}
                onClick={() => setPendente(opcao.valor)}
              >
                <Icone nome={opcao.icone} tamanho={14} />
                {opcao.rotulo}
              </Button>
            ),
          )}
        </div>
      )}

      {enviando && <p className="text-[12px] text-[#8E7C86]">Enviando…</p>}
    </form>
  );
}
