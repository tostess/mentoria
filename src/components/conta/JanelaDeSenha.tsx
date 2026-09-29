"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { CONTROLE, Field } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { trocarSenha } from "@/lib/auth/actions";
import { SENHA_MIN } from "@/lib/auth/senha";

/**
 * A troca de senha, numa janela sobre a tela.
 *
 * Dois jeitos de abrir, o mesmo formulário:
 * - `aviso`: sozinha, ao entrar, enquanto a senha for a provisória;
 * - `menu`: pelo "Redefinir senha" do menu da conta.
 *
 * `<dialog>` nativo com `showModal()`: foco preso dentro, Esc fecha e o resto
 * da tela fica inerte, sem biblioteca. Vai por portal para o `body` porque o
 * menu da conta mora na parte da sidebar que, no celular, fica escondida com
 * `display: none` — e um diálogo dentro de pai escondido não aparece.
 */

export type ModoDaJanela = "aviso" | "menu";

const nada = () => () => {};

export function JanelaDeSenha({
  modo,
  email,
  aoFechar,
}: {
  modo: ModoDaJanela | null;
  email: string | null;
  aoFechar: () => void;
}) {
  const noCliente = useSyncExternalStore(nada, () => true, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const titulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo === null) return;
    if (modo !== null && !dialogo.open) dialogo.showModal();
    if (modo === null && dialogo.open) dialogo.close();
  }, [modo, noCliente]);

  if (!noCliente) return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titulo}
      onClose={aoFechar}
      className="m-auto max-h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-[440px] overflow-y-auto rounded-[14px] border border-[#F3E4EC] bg-white p-0 text-[#2A1B26] backdrop:bg-[#2A1B26]/45"
    >
      {modo !== null && (
        <Conteudo key={modo} modo={modo} email={email} idTitulo={titulo} aoFechar={aoFechar} />
      )}
    </dialog>,
    document.body,
  );
}

function Conteudo({
  modo,
  email,
  idTitulo,
  aoFechar,
}: {
  modo: ModoDaJanela;
  email: string | null;
  idTitulo: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, aoEnviar, enviando] = useEnvioSemReset(trocarSenha);
  const [mostrar, setMostrar] = useState(false);
  const trocou = estado.ok !== null;

  // O token novo, sem a marca, já está no cookie: a casca relê a sessão e o
  // aviso não volta nesta visita.
  useEffect(() => {
    if (trocou) router.refresh();
  }, [trocou, router]);

  const aviso = modo === "aviso";
  const tipo = mostrar ? "text" : "password";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#FBF1DE] text-[#8A5D0C]">
          <Icone nome="key" tamanho={17} />
        </span>
        <div>
          <h2 id={idTitulo} className="font-display text-[24px] font-bold leading-[1.05]">
            {aviso ? "Crie sua senha" : "Redefinir senha"}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#8E7C86]">
            {aviso
              ? "Você entrou com uma senha provisória, criada por outra pessoa e enviada a você por mensagem. Troque agora por uma que só você conhece."
              : "Para trocar, confirme a senha que você usa hoje."}
          </p>
        </div>
      </div>

      {trocou ? (
        <>
          <FormFeedback erro={null} ok={estado.ok} credencial={null} />
          <div className="flex justify-end">
            <Button type="button" onClick={aoFechar}>
              Fechar
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
          <FormFeedback erro={estado.erro} ok={null} credencial={null} />

          {/* Para o gerenciador de senhas saber de qual conta é a senha nova. */}
          {email !== null && (
            <input type="email" autoComplete="username" value={email} readOnly hidden />
          )}

          <Field htmlFor="senha-atual" label={aviso ? "Senha provisória" : "Senha atual"}>
            <input
              id="senha-atual"
              name="atual"
              type={tipo}
              required
              autoComplete="current-password"
              disabled={enviando}
              className={CONTROLE}
            />
          </Field>
          <Field
            htmlFor="senha-nova"
            label="Senha nova"
            hint={`Pelo menos ${SENHA_MIN} caracteres. Quanto mais longa, melhor.`}
          >
            <input
              id="senha-nova"
              name="nova"
              type={tipo}
              required
              minLength={SENHA_MIN}
              autoComplete="new-password"
              disabled={enviando}
              className={CONTROLE}
            />
          </Field>
          <Field htmlFor="senha-confirmacao" label="Repita a senha nova">
            <input
              id="senha-confirmacao"
              name="confirmacao"
              type={tipo}
              required
              minLength={SENHA_MIN}
              autoComplete="new-password"
              disabled={enviando}
              className={CONTROLE}
            />
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] text-[#8E7C86]">
            <input
              type="checkbox"
              checked={mostrar}
              onChange={(e) => setMostrar(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#C2317A]"
            />
            Mostrar as senhas
          </label>

          <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={aoFechar} disabled={enviando}>
              {aviso ? "Agora não" : "Cancelar"}
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Trocando…" : "Trocar senha"}
            </Button>
          </div>

          {aviso && (
            <p className="text-[12px] leading-[1.45] text-[#8E7C86]">
              Enquanto a senha provisória valer, este aviso aparece sempre que você entrar.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
