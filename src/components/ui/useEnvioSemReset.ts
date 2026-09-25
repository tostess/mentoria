"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { FORM_INICIAL, type FormState } from "@/lib/forms";

/**
 * `useActionState` para formulário de **edição**.
 *
 * Com `<form action={...}>`, o React 19 reseta os campos não controlados
 * quando a ação termina — e "termina" inclui devolver erro de validação, porque
 * a função não lançou exceção. Num formulário de criação isso passa; num de
 * edição, apaga o que a pessoa acabou de digitar exatamente quando o servidor
 * recusou, e ela tem de redigitar tudo para corrigir um campo.
 *
 * Enviando por `onSubmit`, com `preventDefault`, o reset não acontece. Os
 * valores novos chegam depois pelo `refresh()` da ação, como `defaultValue`.
 */
export function useEnvioSemReset(
  acao: (anterior: FormState, form: FormData) => Promise<FormState>,
) {
  const [estado, despachar, enviando] = useActionState(acao, FORM_INICIAL);
  const [, iniciar] = useTransition();

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    iniciar(() => despachar(dados));
  }

  return [estado, aoEnviar, enviando] as const;
}
