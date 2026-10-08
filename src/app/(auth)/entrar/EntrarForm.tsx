"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { entrar, type EntrarState } from "@/lib/auth/actions";

const field =
  "w-full rounded-[10px] border border-line2 bg-surface px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent disabled:bg-mist";
const label = "mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-stone";

const INICIAL: EntrarState = { erro: null };

export function EntrarForm({ next, aviso }: { next: string | null; aviso: string | null }) {
  const [estado, formAction, enviando] = useActionState(entrar, INICIAL);
  const erro = estado.erro ?? aviso;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next !== null && <input type="hidden" name="next" value={next} />}

      {erro !== null && (
        <p
          role="alert"
          className="rounded-[10px] border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
        >
          {erro}
        </p>
      )}

      <div>
        <label className={label} htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={enviando}
          className={field}
          placeholder="voce@empresa.com.br"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className={label} htmlFor="senha">
            Senha
          </label>
          <Link
            href="/recuperar-senha"
            className="mb-1.5 text-[12px] text-stone underline-offset-2 hover:text-ink hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          disabled={enviando}
          className={field}
          placeholder="••••••••"
        />
      </div>

      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
