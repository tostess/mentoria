import { Brand } from "@/components/shell/Brand";
import { MenuDaConta } from "@/components/shell/MenuDaConta";
import { NavLinks } from "@/components/shell/NavLinks";
import { SidebarRecolhivel } from "@/components/shell/SidebarRecolhivel";
import { SidebarTop } from "@/components/shell/SidebarTop";
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

      <div className="mt-auto">
        <MenuDaConta email={session.email} senhaProvisoria={session.senhaProvisoria} />
      </div>
    </SidebarRecolhivel>
  );
}
