import { Brand } from "@/components/shell/Brand";
import { NavLinks } from "@/components/shell/NavLinks";
import { SidebarTop } from "@/components/shell/SidebarTop";
import { sair } from "@/lib/auth/actions";
import type { Session } from "@/lib/auth/claims";
import { loadTerms } from "@/lib/config/load";
import { navFor, shellLabel, type Shell } from "@/lib/roles";

export async function Sidebar({ shell, session }: { shell: Shell; session: Session }) {
  const t = await loadTerms();

  return (
    <aside className="flex flex-col gap-[22px] border-b border-[#F3E4EC] bg-white px-4 py-[22px] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <Brand sub={shellLabel(shell, t)} />
      <SidebarTop shell={shell} terms={t} />
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
            className="font-mono text-[10px] text-[#BFAFB8] transition-colors hover:text-[#8E7C86]"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
