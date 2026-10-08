"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, Field } from "@/components/ui/Field";
import { reenviar, type ReenvioState } from "@/lib/cadastro/acoes";

const INICIAL: ReenvioState = { erro: null, ok: null };

/**
 * Pede outro link de confirmação. Com o e-mail já conhecido (logo depois do
 * cadastro) é um botão só; sem ele (link vencido) pede o endereço.
 */
export function ReenviarForm({ email }: { email: string | null }) {
  const [estado, acao, enviando] = useActionState(reenviar, INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-3">
      {email === null ? (
        <Field htmlFor="reenvio-email" label="E-mail do cadastro">
          <input
            id="reenvio-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={enviando}
            className={CONTROLE}
          />
        </Field>
      ) : (
        <input type="hidden" name="email" value={email} />
      )}

      {estado.erro !== null && (
        <p role="alert" className="text-[13px] text-danger">
          {estado.erro}
        </p>
      )}
      {estado.ok !== null && (
        <p role="status" className="text-[13px] text-success">
          {estado.ok}
        </p>
      )}

      <Button type="submit" variant="ghost" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar o link de novo"}
      </Button>
    </form>
  );
}
