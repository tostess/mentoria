import { Brand } from "@/components/shell/Brand";
import { NavLinks } from "@/components/shell/NavLinks";
import { SidebarRecolhivel } from "@/components/shell/SidebarRecolhivel";
import { SidebarTop } from "@/components/shell/SidebarTop";
import { Icone } from "@/components/ui/Icone";
import { sair } from "@/lib/auth/actions";
import type { Session } from "@/lib/auth/claims";
import { loadTerms } from "@/lib/config/load";
import { navFor, shellLabel, type Shell } from "@/lib/roles";

export async function Sidebar({
  shell,
  session,
  saldo,
}: {
  shell: Shell;
  session: Session;
  saldo?: number | null;
}) {
  const t = await loadTerms();

  return (
    <SidebarRecolhivel topo={<Brand sub={shellLabel(shell, t)} />}>
      <SidebarTop shell={shell} terms={t} saldo={saldo} />
      <NavLinks items={navFor(shell, t)} />

      <div className="mt-auto flex flex-col gap-2 px-[5px]">
        {session.email !== null && (
          <span className="truncate font-mono text-[10px] text-[#BFAFB8]" title={session.email}>
            {session.email}
          </span>
        )}
        {/* Sair é ação de servidor: só ele apaga o cookie de sessão de verdade. */}
        <form action={sair}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#BFAFB8] transition-colors hover:text-[#8E7C86]"
          >
            <Icone nome="log-out" tamanho={12} />
            Sair
          </button>
        </form>
      </div>
    </SidebarRecolhivel>
  );
}
