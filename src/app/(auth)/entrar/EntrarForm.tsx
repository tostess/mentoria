"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { entrar, type EntrarState } from "@/lib/auth/actions";

const field =
  "w-full rounded-[10px] border border-[#EAD6E1] bg-white px-3 py-2.5 text-[13.5px] text-[#2A1B26] outline-none focus:border-[#C2317A] disabled:bg-[#FDF8FB]";
const label = "mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]";

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
          className="rounded-[10px] border border-[#F2CFC8] bg-[#FBEAE7] px-3 py-2.5 text-[13px] text-[#A63A2E]"
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
        <label className={label} htmlFor="senha">
          Senha
        </label>
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
