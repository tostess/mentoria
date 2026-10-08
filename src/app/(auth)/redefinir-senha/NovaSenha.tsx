"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CONTROLE, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { redefinirSenha } from "@/lib/auth/actions";
import { lerFragmento, RECUPERACAO_MINUTOS, type FragmentoDoLink } from "@/lib/auth/recuperacao";
import { SENHA_MIN } from "@/lib/auth/senha";
import { FORM_INICIAL } from "@/lib/forms";

/**
 * Lê o fragmento uma vez, guarda os tokens só em memória e limpa a barra —
 * token de sessão no endereço fica no histórico e em qualquer captura de tela.
 *
 * A leitura fica numa ref porque o modo estrito do React roda o efeito duas
 * vezes, e a segunda acharia a barra já limpa (o mesmo defeito achado em
 * `/cadastro/confirmado`).
 */
export function NovaSenha() {
  const lido = useRef<FragmentoDoLink | null>(null);
  const [link, setLink] = useState<FragmentoDoLink | null>(null);
  const [estado, despachar, enviando] = useActionState(redefinirSenha, FORM_INICIAL);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (lido.current === null) {
      lido.current = lerFragmento(window.location.hash);
      if (window.location.hash !== "") window.history.replaceState(null, "", window.location.pathname);
    }
    setLink(lido.current);
  }, []);

  // Envio por `onSubmit`: com `action`, um erro de validação apagaria as senhas digitadas.
  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (link?.tipo !== "tokens") return;
    const dados = new FormData(evento.currentTarget);
    dados.set("access_token", link.accessToken);
    dados.set("refresh_token", link.refreshToken);
    iniciar(() => despachar(dados));
  }

  if (link === null) return <div className="h-[220px]" aria-busy="true" />;

  if (estado.ok !== null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Icone nome="check" tamanho={20} className="mt-1.5 shrink-0 text-success" />
          <div>
            <h1 className="text-[29px]">Senha nova salva</h1>
            <p className="mt-1 text-[13px] leading-[1.5] text-ink">
              Por segurança, saímos da sua conta em todos os aparelhos. Entre de novo com a senha
              nova.
            </p>
          </div>
        </div>
        <ButtonLink href="/entrar">Entrar</ButtonLink>
      </div>
    );
  }

  if (link.tipo !== "tokens") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[29px]">Este link não vale mais</h1>
          <p className="mt-1 text-[13px] leading-[1.5] text-ink">
            O link para criar senha nova vale por pouco tempo e uma vez só. Peça outro — se chegaram
            vários, use o mais recente.
          </p>
        </div>
        <ButtonLink href="/recuperar-senha" variant="ghost">
          Pedir outro link
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      <div>
        <h1 className="text-[29px]">Crie uma senha nova</h1>
        <p className="mt-1 text-[13px] leading-[1.5] text-stone">
          Você tem {RECUPERACAO_MINUTOS} minutos a partir de quando abriu o link.
        </p>
      </div>

      <FormFeedback erro={estado.erro} ok={null} credencial={null} />

      <Field htmlFor="nova" label="Senha nova" hint={`Pelo menos ${SENHA_MIN} caracteres.`}>
        <input
          id="nova"
          name="nova"
          type="password"
          required
          minLength={SENHA_MIN}
          autoComplete="new-password"
          disabled={enviando}
          className={CONTROLE}
        />
      </Field>
      <Field htmlFor="confirmacao" label="Repita a senha nova">
        <input
          id="confirmacao"
          name="confirmacao"
          type="password"
          required
          minLength={SENHA_MIN}
          autoComplete="new-password"
          disabled={enviando}
          className={CONTROLE}
        />
      </Field>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar senha nova"}
      </Button>
    </form>
  );
}
