"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { pedirRecuperacao } from "@/lib/auth/actions";
import { FORM_INICIAL } from "@/lib/forms";

export function RecuperarForm() {
  const [estado, acao, enviando] = useActionState(pedirRecuperacao, FORM_INICIAL);

  return (
    <form action={acao} className="flex flex-col gap-4">
      <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

      <Field htmlFor="rec-email" label="E-mail">
        <input
          id="rec-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={enviando}
          className={CONTROLE}
          placeholder="voce@email.com"
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar o link"}
      </Button>
    </form>
  );
}
