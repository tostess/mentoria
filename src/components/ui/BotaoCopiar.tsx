"use client";

import { useState } from "react";
import { Icone } from "./Icone";

/**
 * Copia um valor para a área de transferência. Feito para a senha provisória:
 * ela tem 16 caracteres sem ambiguidade, mas selecionar com o mouse ainda
 * pega um espaço a mais ou deixa um caractere para trás, e a senha errada só
 * aparece quando a pessoa tenta entrar.
 *
 * "Copiado" é troca de estado, não animação — o sistema de design reserva
 * movimento para presente e extensão.
 */
export function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setFalhou(false);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissão de área de transferência (http, iframe): o valor
      // continua selecionável com `select-all`, e o botão diz que não deu.
      setFalhou(true);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${rotulo}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[7px] border border-[#EFD9A8] bg-white px-2 py-1 text-[11.5px] font-semibold text-[#8A5D0C] transition-colors hover:bg-[#FFFAF0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C98A2E]"
    >
      <Icone nome={copiado ? "check" : "copy"} tamanho={13} />
      <span aria-live="polite">{copiado ? "Copiado" : falhou ? "Selecione" : "Copiar"}</span>
    </button>
  );
}
