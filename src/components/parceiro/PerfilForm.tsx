"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field, FieldRow } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { salvarPerfilAcao } from "@/lib/parceiro/acoes";
import { FORM_INICIAL } from "@/lib/forms";
import type { PerfilDoParceiro } from "@/lib/parceiro/dados";

/**
 * O perfil que o Profissional vê na busca, mais os dois números que governam a
 * agenda: descanso entre sessões e teto semanal.
 *
 * O que **não** está aqui é o `status`. A Etapa 3 tirou essa coluna do Parceiro
 * por privilégio — invariante 8 — e o formulário acompanha: nem aparece, para
 * ninguém tentar e receber um erro de banco sem explicação.
 */
export function PerfilForm({
  perfil,
  expiraEmHoras,
}: {
  perfil: PerfilDoParceiro;
  /** `app_config.limits.pending_expires_hours` — o texto não inventa o número. */
  expiraEmHoras: number;
}) {
  const [estado, acao, enviando] = useActionState(salvarPerfilAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

      <Field htmlFor="nome" label="Nome">
        <input
          id="nome"
          name="nome"
          required
          maxLength={160}
          defaultValue={perfil.nome}
          disabled={enviando}
          className={CONTROLE}
        />
      </Field>

      <Field
        htmlFor="headline"
        label="Chamada"
        hint="Uma linha. É o que aparece embaixo do seu nome na busca."
      >
        <input
          id="headline"
          name="headline"
          maxLength={160}
          defaultValue={perfil.headline ?? ""}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Liderança em ambiente clínico"
        />
      </Field>

      <Field
        htmlFor="bio"
        label="Apresentação"
        hint="Como você trabalha numa sessão de 30 minutos."
      >
        <textarea
          id="bio"
          name="bio"
          rows={5}
          maxLength={2000}
          defaultValue={perfil.bio ?? ""}
          disabled={enviando}
          className={`${CONTROLE} resize-y`}
        />
      </Field>

      <FieldRow>
        <Field htmlFor="areas" label="Áreas" hint="Separadas por vírgula.">
          <input
            id="areas"
            name="areas"
            defaultValue={perfil.areas.join(", ")}
            disabled={enviando}
            className={CONTROLE}
            placeholder="Liderança, Saúde"
          />
        </Field>
        <Field htmlFor="habilidades" label="Habilidades" hint="Separadas por vírgula.">
          <input
            id="habilidades"
            name="habilidades"
            defaultValue={perfil.habilidades.join(", ")}
            disabled={enviando}
            className={CONTROLE}
            placeholder="Feedback, Conflito"
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="senioridade" label="Senioridade">
          <select
            id="senioridade"
            name="senioridade"
            defaultValue={perfil.senioridade ?? ""}
            disabled={enviando}
            className={CONTROLE}
          >
            <option value="">não informar</option>
            <option value="pleno">pleno</option>
            <option value="senior">sênior</option>
            <option value="especialista">especialista</option>
            <option value="executivo">executivo</option>
          </select>
        </Field>
        <Field
          htmlFor="fuso"
          label="Fuso horário"
          hint="Seus horários são no seu relógio, não no de quem agenda."
        >
          <input
            id="fuso"
            name="fuso"
            required
            maxLength={64}
            defaultValue={perfil.fuso}
            disabled={enviando}
            className={CONTROLE_MONO}
            placeholder="America/Sao_Paulo"
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field
          htmlFor="bufferMin"
          label="Descanso entre sessões"
          hint="Minutos. O motor não oferece horário que desrespeite isso."
        >
          <input
            id="bufferMin"
            name="bufferMin"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={perfil.bufferMin}
            disabled={enviando}
            className={CONTROLE_MONO}
          />
        </Field>
        <Field
          htmlFor="maxPorSemana"
          label="Teto por semana"
          hint="Sessões, de domingo a sábado no seu fuso."
        >
          <input
            id="maxPorSemana"
            name="maxPorSemana"
            type="number"
            min={1}
            max={40}
            required
            defaultValue={perfil.maxPorSemana}
            disabled={enviando}
            className={CONTROLE_MONO}
          />
        </Field>
      </FieldRow>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-[#FDF8FB] px-[15px] py-[13px]">
        <input
          type="checkbox"
          name="confirmaSozinho"
          defaultChecked={perfil.confirmaSozinho}
          disabled={enviando}
          className="mt-[3px] h-4 w-4 shrink-0 accent-[#C2317A]"
        />
        <span className="text-[13px] leading-[1.5]">
          <strong className="font-semibold">Confirmar sozinho</strong>
          <span className="block text-[#8E7C86]">
            A sessão já nasce confirmada em vez de esperar você responder. Sem isso, o pedido
            expira em {expiraEmHoras} horas sem resposta, a ficha volta para quem pediu e o horário
            volta para a busca.
          </span>
        </span>
      </label>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar perfil"}
      </Button>
    </form>
  );
}
