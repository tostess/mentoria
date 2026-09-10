import type { Metadata } from "next";
import { Darker_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { resolveTheme } from "@/lib/theme";
import { terms } from "@/lib/terms";

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

export const metadata: Metadata = {
  title: terms.platformName,
  description: "Plataforma de mentoria corporativa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Até a Etapa 4, o tema é o default da plataforma. Depois vem de app_config.
  const theme = resolveTheme(null);
  return (
    <html
      lang="pt-BR"
      className={`${darkerGrotesque.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full">
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
