"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onSoft, withAlpha } from "@/lib/theme";
import type { NavItem } from "@/lib/roles";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const theme = useTheme();
  return (
    <nav className="flex flex-col gap-px" aria-label="Principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-[13.5px] transition-colors ${
              active ? "font-semibold" : "text-[#8E7C86] hover:bg-[#FDF8FB] hover:text-[#2A1B26]"
            }`}
            style={
              active
                ? { backgroundColor: withAlpha(theme.accent, 0.1), color: onSoft(theme.accent) }
                : undefined
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
