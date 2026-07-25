'use client';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { RoleGate } from '@/components/auth/role-gate';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Console' },
  { href: '/admin/mentores', label: 'Mentores' },
  { href: '/admin/personalizacao', label: 'Personalizacao' },
];

/**
 * `moderator` entra no console, mas nao mexe em aparencia nem em regras da
 * moeda — o recorte fino fica nas telas e nas callables da F1.5.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['admin', 'moderator']}>
      <AppShell area="Administracao" nav={NAV}>
        {children}
      </AppShell>
    </RoleGate>
  );
}
