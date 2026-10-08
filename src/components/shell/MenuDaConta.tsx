"use client";

import { useEffect, useId, useRef, useState } from "react";
import { JanelaDeSenha, type ModoDaJanela } from "@/components/conta/JanelaDeSenha";
import { Icone } from "@/components/ui/Icone";
import { sair } from "@/lib/auth/actions";

/**
 * O menu da conta, no pé da sidebar: quem está logado e o que dá para fazer
 * com a própria conta. Começa com "Redefinir senha" e "Sair"; é aqui que as
 * próximas opções da conta entram.
 *
 * Também é quem abre o aviso de senha provisória: a janela é a mesma do
 * "Redefinir senha", e o estado dela mora num lugar só. O aviso abre uma vez
 * por visita — a casca não remonta ao navegar, então "Agora não" vale até a
 * próxima entrada, e não só até o próximo clique.
 */
export function MenuDaConta({
  email,
  senhaProvisoria,
}: {
  email: string | null;
  senhaProvisoria: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [janela, setJanela] = useState<ModoDaJanela | null>(senhaProvisoria ? "aviso" : null);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();

  // Clique fora fecha. Só escuta enquanto aberto.
  useEffect(() => {
    if (!aberto) return;
    function fora(evento: PointerEvent) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }

  const item =
    "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-mist focus-visible:bg-mist focus-visible:outline-none";

  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          e.stopPropagation();
          fechar();
        }
      }}
    >
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label="Opções da conta"
          className="absolute inset-x-0 bottom-full mb-1.5 flex flex-col gap-px rounded-[12px] border border-line2 bg-surface p-1 shadow-[0_8px_24px_rgba(42,27,38,0.08)]"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setAberto(false);
              setJanela("menu");
            }}
          >
            <Icone nome="key" tamanho={15} className="text-stone" />
            Redefinir senha
          </button>
          {/* Sair é ação de servidor: só ele apaga o cookie de sessão de verdade. */}
          <form action={sair}>
            <button type="submit" role="menuitem" className={item}>
              <Icone nome="log-out" tamanho={15} className="text-stone" />
              Sair
            </button>
          </form>
        </div>
      )}

      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icone nome="user" tamanho={15} className="text-faint" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-ink">Minha conta</span>
          {email !== null && (
            <span className="block truncate font-mono text-[10px] text-faint" title={email}>
              {email}
            </span>
          )}
        </span>
        {senhaProvisoria && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-gold"
            title="Senha provisória — troque em Redefinir senha"
          />
        )}
        <Icone
          nome="chevron-up"
          tamanho={14}
          className={`text-faint transition-transform ${aberto ? "" : "rotate-180"}`}
        />
      </button>

      <JanelaDeSenha modo={janela} email={email} aoFechar={() => setJanela(null)} />
    </div>
  );
}
