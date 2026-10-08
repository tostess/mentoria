"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE_MONO, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { FORM_INICIAL } from "@/lib/forms";
import { adicionarFolgaAcao, removerFolgaAcao } from "@/lib/parceiro/acoes";

type Tipo = "bloqueio" | "extra";

/**
 * Folga e horário extra numa data — o que a rotina semanal não descreve.
 *
 * Folga cobre um período (férias, congresso), o dia inteiro ou só uma faixa;
 * horário extra abre uma faixa num dia só. Envia por `onSubmit`
 * (`useEnvioSemReset`): com `action`, o React 19 reseta o formulário quando a
 * ação termina, e o checkbox controlado voltava marcado no DOM com o estado
 * dizendo o contrário — a tela mostrava "dia inteiro" e as horas ao mesmo tempo.
 */
export function NovaFolga({ hoje }: { hoje: string }) {
  const [estado, aoEnviar, enviando] = useEnvioSemReset(adicionarFolgaAcao);
  const [tipo, setTipo] = useState<Tipo>("bloqueio");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("12:00");

  // Deu certo: limpa as datas para a próxima, e mantém o resto. Ajuste durante
  // a renderização, comparando com o retorno anterior — sem efeito, sem a
  // renderização a mais que um `useEffect` com `setState` causaria.
  const [visto, setVisto] = useState(estado);
  if (visto !== estado) {
    setVisto(estado);
    if (estado.ok !== null) {
      setDe("");
      setAte("");
    }
  }

  const comFaixa = tipo === "extra" || !diaInteiro;

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

      <div role="radiogroup" aria-label="Tipo" className="flex gap-1.5">
        {(
          [
            { valor: "bloqueio", rotulo: "Folga" },
            { valor: "extra", rotulo: "Horário extra" },
          ] as const
        ).map((opcao) => {
          const ativo = tipo === opcao.valor;
          return (
            <label
              key={opcao.valor}
              className={`cursor-pointer select-none rounded-[9px] border px-3 py-2 text-[13px] font-semibold transition-colors ${
                ativo ? "border-transparent bg-accent-12 text-on-soft" : "border-line2 bg-surface text-stone"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={opcao.valor}
                checked={ativo}
                onChange={() => setTipo(opcao.valor)}
                className="sr-only"
              />
              {opcao.rotulo}
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="folga-de" label={tipo === "extra" ? "Dia" : "De"}>
          <input
            id="folga-de"
            name="de"
            type="date"
            required
            min={hoje}
            value={de}
            disabled={enviando}
            onChange={(e) => {
              setDe(e.target.value);
              if (ate === "" || ate < e.target.value) setAte(e.target.value);
            }}
            className={CONTROLE_MONO}
          />
        </Field>
        {tipo === "bloqueio" && (
          <Field htmlFor="folga-ate" label="Até">
            <input
              id="folga-ate"
              name="ate"
              type="date"
              required
              min={de || hoje}
              value={ate}
              disabled={enviando}
              onChange={(e) => setAte(e.target.value)}
              className={CONTROLE_MONO}
            />
          </Field>
        )}
      </div>

      {tipo === "bloqueio" && (
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            name="diaInteiro"
            checked={diaInteiro}
            disabled={enviando}
            onChange={(e) => setDiaInteiro(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Dia inteiro
        </label>
      )}

      {comFaixa && (
        <div className="grid grid-cols-2 gap-3">
          <Field htmlFor="folga-inicio" label="Das">
            <input
              id="folga-inicio"
              name="inicio"
              type="time"
              step={900}
              required
              value={inicio}
              disabled={enviando}
              onChange={(e) => setInicio(e.target.value)}
              className={CONTROLE_MONO}
            />
          </Field>
          <Field htmlFor="folga-fim" label="Às">
            <input
              id="folga-fim"
              name="fim"
              type="time"
              step={900}
              required
              value={fim}
              disabled={enviando}
              onChange={(e) => setFim(e.target.value)}
              className={CONTROLE_MONO}
            />
          </Field>
        </div>
      )}

      <Button type="submit" variant="ghost" disabled={enviando} className="self-start">
        <Icone nome={tipo === "extra" ? "plus" : "calendar-off"} tamanho={15} />
        {enviando ? "Salvando…" : tipo === "extra" ? "Abrir horário extra" : "Adicionar folga"}
      </Button>
    </form>
  );
}

/** Remove um período inteiro — todas as linhas do grupo, de uma vez. */
export function RemoverFolga({ ids, rotulo }: { ids: readonly string[]; rotulo: string }) {
  const [estado, enviar, enviando] = useActionState(removerFolgaAcao, FORM_INICIAL);

  return (
    <form action={enviar} className="flex flex-col items-end gap-1">
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <button
        type="submit"
        disabled={enviando}
        aria-label={`Remover ${rotulo}`}
        className="rounded-[8px] p-1.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
      >
        <Icone nome="x" tamanho={15} />
      </button>
      {estado.erro !== null && (
        <span role="alert" className="text-[12px] text-danger">
          {estado.erro}
        </span>
      )}
    </form>
  );
}
