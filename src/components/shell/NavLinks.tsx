"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone } from "@/components/ui/Icone";
import type { NavItem } from "@/lib/roles";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-px" aria-label="Principal">
      {items.map((item) => {
        // Por segmento, não por string: `/parceiros` não é filho de `/parceiro`.
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? "bg-accent-10 font-semibold text-on-soft" : "text-stone hover:bg-mist hover:text-ink"
            }`}
          >
            <Icone
              nome={item.icone}
              className={active ? "" : "text-faint transition-colors group-hover:text-stone"}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
