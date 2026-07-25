'use client';

import { AppShell, type NavItem } from '@/components/layout/app-shell';
import { RoleGate } from '@/components/auth/role-gate';

const NAV: NavItem[] = [
  { href: '/mentor', label: 'Painel' },
  { href: '/mentor/disponibilidade', label: 'Disponibilidade' },
  { href: '/mentor/agenda', label: 'Agenda' },
];

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={['mentor', 'admin']}>
      <AppShell area="Mentor" nav={NAV}>
        {children}
      </AppShell>
    </RoleGate>
  );
}
