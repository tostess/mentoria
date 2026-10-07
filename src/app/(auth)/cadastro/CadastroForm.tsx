"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CONTROLE, Field, FieldRow } from "@/components/ui/Field";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cadastrar, type CadastroState } from "@/lib/cadastro/acoes";
import { SENHA_MIN } from "@/lib/auth/senha";
import { CAMPO_ARMADILHA, OBJETIVO_MAX } from "@/lib/cadastro/regras";
import { ReenviarForm } from "./ReenviarForm";

const INICIAL: CadastroState = { erro: null, enviadoPara: null };

/**
 * O formulário do cadastro. Envia por `onSubmit`, não por `action`: com
 * `action` o React 19 reseta os campos quando a ação termina, e devolver erro
 * de validação conta como terminar — a pessoa perderia o texto sobre o que
 * busca na mentoria justo quando o servidor recusou outra coisa.
 */
export function CadastroForm({
  termoConta,
  termosUrl,
  privacidadeUrl,
}: {
  termoConta: string;
  termosUrl: string | null;
  privacidadeUrl: string | null;
}) {
  const [estado, despachar, enviando] = useActionState(cadastrar, INICIAL);
  const [, iniciar] = useTransition();
  const { accent } = useTheme();

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    iniciar(() => despachar(dados));
  }

  if (estado.enviadoPara !== null) {
    return <Enviado email={estado.enviadoPara} />;
  }

  const link = (href: string | null, texto: string) =>
    href === null ? (
      texto
    ) : (
      <a href={href} target="_blank" rel="noreferrer" className="underline" style={{ color: accent }}>
        {texto}
      </a>
    );

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
      {estado.erro !== null && (
        <p
          role="alert"
          className="rounded-[10px] border border-[#F2CFC8] bg-[#FBEAE7] px-3 py-2.5 text-[13px] text-[#A63A2E]"
        >
          {estado.erro}
        </p>
      )}

      <Field htmlFor="cad-nome" label="Nome">
        <input
          id="cad-nome"
          name="nome"
          required
          maxLength={160}
          autoComplete="name"
          disabled={enviando}
          className={CONTROLE}
        />
      </Field>

      <Field
        htmlFor="cad-email"
        label="E-mail"
        hint="Se você já tem conta pela sua empresa, use outro e-mail: a conta pessoal é separada."
      >
        <input
          id="cad-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={enviando}
          className={CONTROLE}
          placeholder="voce@email.com"
        />
      </Field>

      <FieldRow>
        <Field htmlFor="cad-senha" label="Senha" hint={`Pelo menos ${SENHA_MIN} caracteres.`}>
          <input
            id="cad-senha"
            name="senha"
            type="password"
            required
            minLength={SENHA_MIN}
            autoComplete="new-password"
            disabled={enviando}
            className={CONTROLE}
          />
        </Field>
        <Field htmlFor="cad-confirmacao" label="Repita a senha">
          <input
            id="cad-confirmacao"
            name="confirmacao"
            type="password"
            required
            minLength={SENHA_MIN}
            autoComplete="new-password"
            disabled={enviando}
            className={CONTROLE}
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="cad-cargo" label="Cargo ou ocupação">
          <input
            id="cad-cargo"
            name="cargo"
            maxLength={120}
            autoComplete="organization-title"
            disabled={enviando}
            className={CONTROLE}
            placeholder="Enfermeira"
          />
        </Field>
        <Field htmlFor="cad-area" label="Área">
          <input
            id="cad-area"
            name="area"
            maxLength={120}
            disabled={enviando}
            className={CONTROLE}
            placeholder="Saúde"
          />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field htmlFor="cad-telefone" label="Telefone" hint="Opcional.">
          <input
            id="cad-telefone"
            name="telefone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            disabled={enviando}
            className={CONTROLE}
            placeholder="(11) 98765-4321"
          />
        </Field>
        <Field htmlFor="cad-linkedin" label="LinkedIn" hint="Opcional.">
          <input
            id="cad-linkedin"
            name="linkedin"
            maxLength={300}
            inputMode="url"
            disabled={enviando}
            className={CONTROLE}
            placeholder="linkedin.com/in/voce"
          />
        </Field>
      </FieldRow>

      <Field
        htmlFor="cad-objetivo"
        label="O que você busca na mentoria"
        hint="Algumas linhas bastam. É o que lemos para aprovar o pedido."
      >
        <textarea
          id="cad-objetivo"
          name="objetivo"
          required
          rows={4}
          maxLength={OBJETIVO_MAX}
          disabled={enviando}
          className={`${CONTROLE} resize-y`}
          placeholder="Assumi a coordenação da equipe há pouco tempo e quero conversar sobre…"
        />
      </Field>

      {/* Armadilha para robô: fora da tela e fora da ordem de tabulação. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="cad-site">Site</label>
        <input id="cad-site" name={CAMPO_ARMADILHA} tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[#2A1B26]">
        <input
          type="checkbox"
          name="aceite"
          required
          disabled={enviando}
          className="mt-[3px] h-4 w-4 shrink-0"
          style={{ accentColor: accent }}
        />
        <span>
          Li e aceito os {link(termosUrl, "termos de uso")} e a{" "}
          {link(privacidadeUrl, "política de privacidade")}.
        </span>
      </label>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : `Criar ${termoConta.toLowerCase()}`}
      </Button>
    </form>
  );
}

function Enviado({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Icone nome="mail" tamanho={20} className="mt-1 shrink-0 text-[#8E7C86]" />
        <div>
          <h2 className="text-[22px]">Confira seu e-mail</h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#2A1B26]">
            Enviamos um link para <span className="font-semibold">{email}</span>. Confirme o endereço
            para o pedido seguir para análise.
          </p>
        </div>
      </div>

      <Note variant="gold">
        Não chegou? Procure no spam. Se este e-mail já tem conta — pela sua empresa, por exemplo —,
        nenhum link é enviado: a conta pessoal precisa de outro endereço.
      </Note>

      <ReenviarForm email={email} />
    </div>
  );
}
