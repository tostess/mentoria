'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/auth-context';
import { getFirebase } from '@/lib/firebase/client';
import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';

export interface NavItem {
  href: string;
  label: string;
}

const b = DEFAULT_APP_CONFIG.branding;

/**
 * Casca das tres visoes. Estados visuais por `className` condicional do
 * Tailwind; cores em hex inline (CLAUDE.md).
 */
export function AppShell({
  area,
  nav,
  children,
}: {
  area: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, orgId } = useAuth();

  async function handleSignOut() {
    const { auth } = getFirebase();
    await signOut(auth);
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="hidden w-60 shrink-0 flex-col border-r p-4 md:flex"
        style={{ backgroundColor: b.surface, borderColor: b.border }}
      >
        <div className="mb-6">
          <div className="text-base font-semibold" style={{ color: b.text }}>
            {b.productName}
          </div>
          <div className="text-xs" style={{ color: b.textMuted }}>
            {area}
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  active ? 'font-medium' : 'hover:bg-[#F1F5F9]',
                )}
                style={
                  active
                    ? { backgroundColor: '#EEF2FF', color: b.primary }
                    : { color: b.textMuted }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t pt-4 text-xs" style={{ borderColor: b.border }}>
          <div className="truncate" style={{ color: b.text }}>
            {user?.email ?? '—'}
          </div>
          <div style={{ color: b.textMuted }}>
            {role} · {orgId}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 text-xs underline"
            style={{ color: b.textMuted }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
