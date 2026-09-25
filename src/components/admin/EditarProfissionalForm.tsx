"use client";

import { Button } from "@/components/ui/Button";
import { CONTROLE, Field, FieldRow } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { editarProfissionalAcao } from "@/lib/admin/acoes";
import type { DadosDoProfissional } from "@/lib/pessoas/edicao";

/**
 * Os dados do colaborador. Empresa e papel não estão aqui: mudar alguém de
 * empresa mexeria em carteira e livro-caixa, e é outra operação.
 */
export function EditarProfissionalForm({
  id,
  orgId,
  dados,
  somenteLeitura,
}: {
  id: string;
  orgId: string;
  dados: DadosDoProfissional;
  somenteLeitura: boolean;
}) {
  const [estado, aoEnviar, enviando] = useEnvioSemReset(editarProfissionalAcao);
  const bloqueado = enviando || somenteLeitura;

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orgId" value={orgId} />
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

      <FieldRow>
        <Field htmlFor="epr-nome" label="Nome">
          <input
            id="epr-nome"
            name="nome"
            required
            maxLength={160}
            defaultValue={dados.nome}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
        <Field htmlFor="epr-email" label="E-mail" hint="Trocar o e-mail troca também o login.">
          <input
            id="epr-email"
            name="email"
            type="email"
            required
            defaultValue={dados.email}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="epr-cargo" label="Cargo">
          <input
            id="epr-cargo"
            name="cargo"
            maxLength={120}
            defaultValue={dados.cargo ?? ""}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
        <Field htmlFor="epr-area" label="Área">
          <input
            id="epr-area"
            name="area"
            maxLength={120}
            defaultValue={dados.area ?? ""}
            disabled={bloqueado}
            className={CONTROLE}
          />
        </Field>
      </FieldRow>

      {!somenteLeitura && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[12px] text-[#8E7C86]">Só o que mudar vai para o histórico.</span>
          <Button type="submit" disabled={enviando}>
            <Icone nome="check" tamanho={15} />
            {enviando ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      )}
    </form>
  );
}
