"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icone } from "@/components/ui/Icone";

/**
 * A sidebar que, abaixo de 1024px, vira barra de topo com botão de menu.
 *
 * Antes ela só descia para o topo da página, inteira — marca, saldo, os
 * links e o "Sair" empilhados — e o conteúdo começava depois de meia tela de
 * navegação. Agora a barra fica fixa no topo com a marca, e o resto abre sob
 * demanda.
 *
 * O menu fecha sozinho quando a rota muda: guarda-se o caminho em que ele foi
 * aberto, e aberto é "aberto neste caminho". Navegar muda o caminho e o menu
 * some, sem efeito colateral para sincronizar.
 */
export function SidebarRecolhivel({ topo, children }: { topo: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;

  return (
    <aside className="sticky top-0 z-30 flex max-h-screen flex-col gap-[22px] overflow-y-auto border-b border-line bg-surface px-4 py-3 lg:h-screen lg:border-b-0 lg:border-r lg:py-[22px]">
      <div className="flex items-center justify-between gap-3">
        {topo}
        <button
          type="button"
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] border border-line2 text-ink transition-colors hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
          aria-expanded={aberto}
          aria-controls="menu-principal"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          onClick={() => setAbertoEm(aberto ? null : pathname)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAbertoEm(null);
          }}
        >
          <Icone nome={aberto ? "x" : "menu"} tamanho={18} />
        </button>
      </div>

      <div
        id="menu-principal"
        className={`${aberto ? "flex" : "hidden"} flex-1 flex-col gap-[22px] pb-2 lg:flex lg:pb-0`}
      >
        {children}
      </div>
    </aside>
  );
}
