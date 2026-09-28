import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icone } from "@/components/ui/Icone";
import type { NomeIcone } from "@/components/ui/icones";

/**
 * A casca das telas em volta da sala — cedo demais, não confirmada, fim. Fora
 * da sidebar, como a sala, para a pessoa não sair da conversa por um menu.
 */
export function Portao({
  voltar,
  titulo,
  icone,
  tomDoIcone = "text-[#8E7C86]",
  quem,
  children,
}: {
  /** Destino do "Voltar"; sem ele, o topo fica só com quem e quando. */
  voltar?: string;
  titulo: string;
  icone: NomeIcone;
  tomDoIcone?: string;
  quem?: { nome: string; foto: string | null; titulo: string; quando: string };
  children?: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#FDF8FB]">
      <header className="flex items-center gap-4 border-b border-[#F3E4EC] bg-white px-4 py-3 lg:px-5">
        {voltar && (
          <>
            <Link
              href={voltar}
              className="inline-flex items-center gap-1.5 text-[13px] text-[#8E7C86] hover:text-[#C2317A]"
            >
              <Icone nome="chevron-left" tamanho={14} />
              Voltar
            </Link>
            {quem && <span className="h-7 w-px bg-[#F3E4EC]" />}
          </>
        )}
        {quem && (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={quem.nome} photoUrl={quem.foto} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">{quem.titulo}</div>
              <div className="font-mono text-[11px] text-[#8E7C86]">{quem.quando}</div>
            </div>
          </div>
        )}
      </header>
      <main className="grid place-items-center px-4 py-14 sm:py-20">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-3 text-center">
          <Icone nome={icone} tamanho={22} className={tomDoIcone} />
          <h1 className="text-[28px] sm:text-[32px]">{titulo}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
