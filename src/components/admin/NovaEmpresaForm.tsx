"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field, FieldRow } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { criarEmpresaAcao } from "@/lib/admin/acoes";
import { FORM_INICIAL } from "@/lib/forms";

/**
 * A empresa nasce com contrato zero: o bloco de fichas é registrado depois, na
 * tela dela. São dois fatos diferentes — existir e ter comprado — e juntá-los
 * num formulário só faria a compra virar campo obrigatório de cadastro.
 */
export function NovaEmpresaForm({ termoEmpresa }: { termoEmpresa: string }) {
  const [estado, acao, enviando] = useActionState(criarEmpresaAcao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3.5">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={estado.credencial} />

      <Field htmlFor="nome" label="Nome">
        <input
          id="nome"
          name="nome"
          required
          maxLength={160}
          disabled={enviando}
          className={CONTROLE}
          placeholder="Faculdade Aurora"
        />
      </Field>

      <Field htmlFor="cnpj" label="CNPJ" hint="Opcional. 14 dígitos, com ou sem pontuação.">
        <input
          id="cnpj"
          name="cnpj"
          inputMode="numeric"
          disabled={enviando}
          className={CONTROLE_MONO}
          placeholder="00.000.000/0000-00"
        />
      </Field>

      <FieldRow>
        <Field htmlFor="inicio" label="Início do contrato">
          <input
            id="inicio"
            name="inicio"
            type="date"
            disabled={enviando}
            className={CONTROLE_MONO}
          />
        </Field>
        <Field htmlFor="fim" label="Fim">
          <input id="fim" name="fim" type="date" disabled={enviando} className={CONTROLE_MONO} />
        </Field>
      </FieldRow>

      <Field
        htmlFor="accent"
        label="Cor da marca"
        hint="Opcional. Sem cor, a empresa herda a paleta da plataforma."
      >
        <input
          id="accent"
          name="accent"
          maxLength={9}
          disabled={enviando}
          className={CONTROLE_MONO}
          placeholder="#C2317A"
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Criando…" : `Criar ${termoEmpresa.toLowerCase()}`}
      </Button>
    </form>
  );
}
