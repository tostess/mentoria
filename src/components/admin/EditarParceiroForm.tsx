"use client";

import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field, FieldRow } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { editarParceiroAcao } from "@/lib/admin/acoes";
import { SENIORIDADES } from "@/lib/parceiro/senioridades";
import type { DadosDoParceiro } from "@/lib/pessoas/edicao";

/**
 * Os dados do Parceiro, pela mão da operadora.
 *
 * São os mesmos campos que o Parceiro edita em `/parceiro/perfil`, mais
 * e-mail e vínculo — que são dele mas não é ele quem decide. `status` não está
 * aqui: tem card próprio, com confirmação, porque arquivar alguém não pode ser
 * efeito colateral de corrigir uma vírgula na apresentação.
 *
 * Só o que mudar vai para o histórico; salvar sem mudar nada não grava linha.
 */
export function EditarParceiroForm({
  id,
  dados,
  somenteLeitura,
}: {
  id: string;
  dados: DadosDoParceiro;
  somenteLeitura: boolean;
}) {
  const [estado, aoEnviar, enviando] = useEnvioSemReset(editarParceiroAcao);
  const bloqueado = enviando || somenteLeitura;

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
      <input type="hidden" name="id" value={id} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

      <FieldRow>
        <Field htmlFor="ep-nome" label="Nome">
          <input
            id="ep-nome"
            name="nome"
            required
            maxLength={160}
            defaultValue={dados.nome}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
        <Field htmlFor="ep-email" label="E-mail" hint="Trocar o e-mail troca também o login.">
          <input
            id="ep-email"
            name="email"
            type="email"
            required
            defaultValue={dados.email}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
      </FieldRow>

      <Field
        htmlFor="ep-headline"
        label="Chamada do perfil"
        hint="A linha embaixo do nome na busca."
      >
        <input
          id="ep-headline"
          name="headline"
          maxLength={160}
          defaultValue={dados.headline ?? ""}
          disabled={bloqueado}
          className={CONTROLE}
        />
      </Field>

      <FieldRow>
        <Field htmlFor="ep-engajamento" label="Vínculo">
          <select
            id="ep-engajamento"
            name="engajamento"
            defaultValue={dados.engajamento}
            disabled={bloqueado}
            className={CONTROLE}
          >
            <option value="voluntario">voluntário</option>
            <option value="parceria">parceria</option>
            <option value="remunerado">remunerado</option>
          </select>
        </Field>
        <Field htmlFor="ep-senioridade" label="Senioridade">
          <select
            id="ep-senioridade"
            name="senioridade"
            defaultValue={dados.senioridade ?? ""}
            disabled={bloqueado}
            className={CONTROLE}
          >
            <option value="">não informar</option>
            {SENIORIDADES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="ep-semana" label="Sessões por semana" hint="De domingo a sábado.">
          <input
            id="ep-semana"
            name="maxPorSemana"
            type="number"
            min={1}
            max={40}
            required
            defaultValue={dados.maxPorSemana}
            disabled={bloqueado}
            className={CONTROLE_MONO}
          />
        </Field>
        <Field htmlFor="ep-buffer" label="Descanso entre sessões" hint="Em minutos.">
          <input
            id="ep-buffer"
            name="bufferMin"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={dados.bufferMin}
            disabled={bloqueado}
            className={CONTROLE_MONO}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="ep-areas" label="Áreas" hint="Separadas por vírgula.">
          <input
            id="ep-areas"
            name="areas"
            defaultValue={dados.areas.join(", ")}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
        <Field htmlFor="ep-habilidades" label="Habilidades" hint="Separadas por vírgula.">
          <input
            id="ep-habilidades"
            name="habilidades"
            defaultValue={dados.habilidades.join(", ")}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
      </FieldRow>

      <Field
        htmlFor="ep-fuso"
        label="Fuso horário"
        hint="Os horários oferecidos seguem este relógio."
      >
        <input
          id="ep-fuso"
          name="fuso"
          required
          maxLength={64}
          defaultValue={dados.fuso}
          disabled={bloqueado}
          className={CONTROLE_MONO}
        />
      </Field>

      <Field htmlFor="ep-bio" label="Apresentação">
        <textarea
          id="ep-bio"
          name="bio"
          rows={5}
          maxLength={2000}
          defaultValue={dados.bio ?? ""}
          disabled={bloqueado}
          className={`${CONTROLE} resize-y`}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] bg-mist px-[15px] py-[13px]">
        <input
          type="checkbox"
          name="confirmaSozinho"
          defaultChecked={dados.confirmaSozinho}
          disabled={bloqueado}
          className="mt-[3px] h-4 w-4 shrink-0 accent-accent"
        />
        <span className="text-[13px] leading-[1.5]">
          <strong className="font-semibold">Confirmar sozinho</strong>
          <span className="block text-stone">
            A sessão já nasce confirmada, sem esperar resposta.
          </span>
        </span>
      </label>

      {!somenteLeitura && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[12px] text-stone">Só o que mudar vai para o histórico.</span>
          <Button type="submit" disabled={enviando}>
            <Icone nome="check" tamanho={15} />
            {enviando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}
    </form>
  );
}
