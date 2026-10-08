"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field, FieldRow } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { criarParceiroAcao } from "@/lib/admin/acoes";
import { FORM_INICIAL } from "@/lib/forms";

/**
 * Invariante 8: o Parceiro não se autocadastra. No piloto ele entra por aqui —
 * decisão do admin, registrada em `audit_logs` com `approved_by`.
 *
 * Nasce `active`, e não `invited`, porque no piloto não há onboarding para ele
 * percorrer: quem preenche este formulário já falou com a pessoa. Convite por
 * token e candidatura espontânea são F1.5.
 */
export function NovoParceiroForm({ termoParceiro }: { termoParceiro: string }) {
  const [estado, acao, enviando] = useActionState(criarParceiroAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="pa-nome" label="Nome">
        <input
          id="pa-nome"
          name="nome"
          required
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Helena Braga"
        />
      </Field>

      <Field htmlFor="pa-email" label="E-mail">
        <input
          id="pa-email"
          name="email"
          type="email"
          required
          disabled={enviando}
          className={CONTROLE}
          placeholder="helena@exemplo.com.br"
        />
      </Field>

      <Field htmlFor="pa-headline" label="Chamada do perfil">
        <input
          id="pa-headline"
          name="headline"
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Liderança em ambiente clínico"
        />
      </Field>

      <FieldRow>
        <Field htmlFor="pa-engajamento" label="Vínculo">
          <select
            id="pa-engajamento"
            name="engajamento"
            defaultValue="voluntario"
            disabled={enviando}
            className={CONTROLE}
          >
            <option value="voluntario">voluntário</option>
            <option value="parceria">parceria</option>
            <option value="remunerado">remunerado</option>
          </select>
        </Field>
        <Field htmlFor="pa-semana" label="Sessões por semana">
          <input
            id="pa-semana"
            name="maxPorSemana"
            type="number"
            min={1}
            max={40}
            defaultValue={4}
            required
            disabled={enviando}
            className={CONTROLE_MONO}
          />
        </Field>
      </FieldRow>

      <Field
        htmlFor="pa-areas"
        label="Áreas"
        hint="Separadas por vírgula. Alimentam a busca do Profissional."
      >
        <input
          id="pa-areas"
          name="areas"
          disabled={enviando}
          className={CONTROLE}
          placeholder="Liderança, Saúde"
        />
      </Field>

      <Field htmlFor="pa-bio" label="Apresentação">
        <textarea
          id="pa-bio"
          name="bio"
          rows={4}
          maxLength={2000}
          disabled={enviando}
          className={`${CONTROLE} resize-y`}
          placeholder="Como você trabalha numa sessão de 30 minutos."
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando…" : `Criar ${termoParceiro} ativo`}
      </Button>

      <p className="text-[12px] leading-[1.45] text-stone">
        Criado aqui, já nasce ativo e visível a todas as empresas contratantes. A decisão fica
        registrada com o seu nome.
      </p>
    </form>
  );
}
