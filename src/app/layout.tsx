import type { Metadata } from 'next';

import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';
import { getAppConfig } from '@/lib/config/server';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getAppConfig();
  return {
    title: config.branding.productName,
    description: config.copy.tagline,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
