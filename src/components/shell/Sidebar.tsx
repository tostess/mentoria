import Link from "next/link";
import { Brand } from "@/components/shell/Brand";
import { NavLinks } from "@/components/shell/NavLinks";
import { SidebarTop } from "@/components/shell/SidebarTop";
import { NAV_BY_SHELL, SHELL_LABEL, type Shell } from "@/lib/roles";

export function Sidebar({ shell }: { shell: Shell }) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <aside className="flex flex-col gap-[22px] border-b border-[#F3E4EC] bg-white px-4 py-[22px] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <Brand sub={SHELL_LABEL[shell]} />
      <SidebarTop shell={shell} />
      <NavLinks items={NAV_BY_SHELL[shell]} />
      <div className="mt-auto flex flex-col gap-1 px-[5px] font-mono text-[10px] leading-[1.6] text-[#BFAFB8]">
        {isDev && (
          <Link href="/" className="hover:text-[#8E7C86]">
            Trocar de casca
          </Link>
        )}
        <span>Etapa 1 · só esqueleto</span>
      </div>
    </aside>
  );
}
