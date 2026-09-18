import type { Metadata } from "next";
import { Darker_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { TermsProvider } from "@/components/config/TermsProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getSession } from "@/lib/auth/session";
import { loadAppConfig, loadTheme } from "@/lib/config/load";

const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker-grotesque",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * Nada nesta aplicação é estático.
 *
 * O layout raiz lê a sessão para resolver marca e vocabulário, e toda tela
 * abaixo dele é de alguém — de um papel, de uma empresa. Sem esta linha o
 * Next tenta pré-renderizar as cascas no build, onde não há cookie nem
 * requisição, e o que sai é a página de uma pessoa que não existe.
 */
export const dynamic = "force-dynamic";

/** O nome no título é o da marca resolvida — a empresa pode ter o dela. */
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const theme = await loadTheme(session?.orgId ?? null);
  return {
    title: theme.platformName,
    description: "Plataforma de mentoria corporativa",
  };
}

/**
 * Tema e vocabulário são resolvidos uma vez, aqui, e descem por contexto.
 * Nenhum componente lê `app_config` por conta própria — se lesse, cada tela
 * poderia discordar da outra sobre como a empresa chama uma ficha.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const [config, theme] = await Promise.all([
    loadAppConfig(),
    loadTheme(session?.orgId ?? null),
  ]);

  return (
    <html
      lang="pt-BR"
      className={`${darkerGrotesque.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full">
        <ThemeProvider theme={theme}>
          <TermsProvider terms={config.terms}>{children}</TermsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
