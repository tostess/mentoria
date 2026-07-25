'use client';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { RoleGate } from '@/components/auth/role-gate';

const NAV: NavItem[] = [
  { href: '/inicio', label: 'Inicio' },
  { href: '/mentores', label: 'Mentores' },
  { href: '/agenda', label: 'Minha agenda' },
  { href: '/carteira', label: 'Carteira' },
];

export default function MenteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['mentee', 'admin']}>
      <AppShell area="Mentorado" nav={NAV}>
        {children}
      </AppShell>
    </RoleGate>
  );
}
