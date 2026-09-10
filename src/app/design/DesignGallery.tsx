"use client";

import { useState, type ReactNode } from "react";
import { Brand } from "@/components/shell/Brand";
import { NavLinks } from "@/components/shell/NavLinks";
import { PageHeader } from "@/components/shell/PageHeader";
import { SidebarTop } from "@/components/shell/SidebarTop";
import { ThemeProvider, useTheme } from "@/components/theme/ThemeProvider";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Ficha,
  FichaStack,
  Note,
  Pill,
  Price,
  Rail,
  Stat,
  Tag,
} from "@/components/ui";
import { NAV_BY_SHELL, SHELL_LABEL, type Shell } from "@/lib/roles";
import { cap, countFichas, terms } from "@/lib/terms";
import { DEFAULT_THEME, normalizeHex, resolveTheme } from "@/lib/theme";

const PRESETS: { name: string; hex: string }[] = [
  { name: "Plataforma", hex: DEFAULT_THEME.accent },
  { name: "Universidade", hex: "#1F4E9C" },
  { name: "Hospital", hex: "#1B7F6B" },
  { name: "Cooperativa", hex: "#5B3FA0" },
  { name: "Indústria", hex: "#B8561E" },
];

const SHELLS: Shell[] = ["professional", "partner", "org", "admin"];

export function DesignGallery() {
  const [accent, setAccent] = useState(DEFAULT_THEME.accent);
  const [draft, setDraft] = useState(DEFAULT_THEME.accent);
  const theme = resolveTheme({ branding: { accent } });

  function commit(value: string) {
    setDraft(value);
    const hex = normalizeHex(value);
    if (hex) setAccent(hex);
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="mx-auto max-w-[1140px] px-[18px] pb-[70px] pt-6 lg:px-10 lg:pt-[34px]">
        <PageHeader
          eyebrow="Só em desenvolvimento"
          title="Sistema de design"
          description="Tudo que está aqui lê o accent do tema resolvido. Troque a cor e nada deve ficar para trás."
        />

        <Card title="Accent" className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => commit(p.hex)}
                className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] ${
                  accent === p.hex ? "border-[#2A1B26]" : "border-[#EAD6E1] hover:border-[#8E7C86]"
                }`}
              >
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.hex }} />
                {p.name}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 font-mono text-[12px]">
              <input
                type="color"
                value={accent}
                onChange={(e) => commit(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-[8px] border border-[#EAD6E1] bg-white p-0.5"
                aria-label="Escolher accent"
              />
              <input
                type="text"
                value={draft}
                onChange={(e) => commit(e.target.value)}
                className="w-[104px] rounded-[8px] border border-[#EAD6E1] bg-white px-2 py-1.5 font-mono text-[12px] uppercase"
                aria-label="Accent em hex"
              />
            </label>
          </div>
        </Card>

        <Section title="Paleta">
          <Palette />
        </Section>

        <Section title="Tipografia">
          <div className="flex flex-col gap-3">
            <h1 className="text-[40px]">Darker Grotesque 700 — títulos</h1>
            <h3 className="text-[20px]">Darker Grotesque 600 — subtítulos</h3>
            <p className="text-[14.5px]">
              Instrument Sans 400 — corpo. Tratamento <b className="font-semibold">você</b>, tom profissional e
              próximo.
            </p>
            <p className="font-mono text-[12px]">IBM Plex Mono 500 — horários 09:30, números 2/6, rótulos</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">
              Rótulo em caixa alta com tracking
            </p>
          </div>
        </Section>

        <Section title="Button">
          <Row>
            <Button>Primário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="warn">Warn</Button>
            <Button variant="gold">Gold</Button>
            <Button disabled>Desativado</Button>
          </Row>
          <Row>
            <Button size="sm">Primário sm</Button>
            <Button size="sm" variant="ghost">
              Ghost sm
            </Button>
            <Button size="sm" variant="warn">
              Warn sm
            </Button>
            <Button size="sm" variant="gold">
              Gold sm
            </Button>
          </Row>
        </Section>

        <Section title="Card">
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Com título" action={<Pill variant="on">Ativo</Pill>}>
              Conteúdo do card. Muito branco, borda fina, raio de 14px.
            </Card>
            <Card flat>Card flat, sem borda, para blocos dentro de outros cards.</Card>
          </div>
        </Section>

        <Section title="Pill">
          <Row>
            <Pill>Neutro</Pill>
            <Pill variant="on">Confirmada</Pill>
            <Pill variant="wait">Aguardando</Pill>
            <Pill variant="off">Pausado</Pill>
            <Pill variant="bad">Denúncia</Pill>
            <Pill variant="accent">Accent</Pill>
          </Row>
        </Section>

        <Section title="Tag">
          <Row>
            <Tag>Liderança</Tag>
            <Tag>Carreira</Tag>
            <Tag>Gestão de conflitos</Tag>
            <Tag>Comunicação</Tag>
          </Row>
        </Section>

        <Section title="Stat">
          <div className="grid gap-4 md:grid-cols-4">
            <Stat tone="gold" value={2} label={`${terms.fichas} disponíveis`} />
            <Stat value={3} label="Sessões no mês" />
            <Stat value="87%" label="Utilização" />
            <Stat value="4,9" label="Avaliação média" />
          </div>
        </Section>

        <Section title="Avatar">
          <Row>
            <Avatar name="Ana Beatriz Lima" size="sm" />
            <Avatar name="Ana Beatriz Lima" size="md" />
            <Avatar name="Carlos Eduardo" size="lg" color="#7A4A8E" />
            <Avatar name="Fernanda" size="xl" color="#2E7A8E" />
          </Row>
        </Section>

        <Section title={cap(terms.ficha)}>
          <Row>
            <Ficha size="s" />
            <Ficha size="m" />
            <Ficha size="l" />
            <Ficha size="xl" />
            <span className="ml-4">
              <FichaStack count={4} />
            </span>
          </Row>
          <p className="mt-3 text-[12.5px] text-[#8E7C86]">
            Ouro fixo, não muda com o accent. A única coisa dourada do sistema.
          </p>
        </Section>

        <Section title="Price">
          <Row>
            <Price fichas={1} />
            <Price fichas={2} />
            <span className="text-[13px] text-[#8E7C86]">{countFichas(1)} por sessão de 30 min</span>
          </Row>
        </Section>

        <Section title="Rail">
          <div className="grid gap-4 md:grid-cols-3">
            <Rail
              day="Seg 14"
              slots={[{ label: "09:00" }, { label: "09:30", taken: true }, { label: "14:00" }]}
            />
            <Rail
              day="Qua 16"
              slots={[{ label: "08:00" }, { label: "08:30" }, { label: "19:00" }, { label: "19:30" }]}
            />
            <Rail day="Sex 18" slots={[{ label: "17:00", taken: true }]} />
          </div>
        </Section>

        <Section title="Note">
          <div className="grid gap-4 md:grid-cols-2">
            <Note icon="✦">
              Cancelou com mais de 12h de antecedência, a {terms.ficha} volta para você.
            </Note>
            <Note variant="gold" icon={<Ficha size="s" />}>
              {cap(terms.fichas)} não são compráveis nem transferíveis entre {terms.professionals.toLowerCase()}.
            </Note>
          </div>
        </Section>

        <Section title="EmptyState">
          <EmptyState
            title="Nenhuma sessão marcada"
            description={`Escolha um ${terms.partner} e um horário para começar.`}
            action={<Button size="sm">Encontrar {terms.partner}</Button>}
          />
        </Section>

        <Section title="Sidebar por papel">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SHELLS.map((shell) => (
              <div
                key={shell}
                className="flex w-full flex-col gap-[22px] rounded-[14px] border border-[#F3E4EC] bg-white px-4 py-[22px]"
              >
                <Brand sub={SHELL_LABEL[shell]} />
                <SidebarTop shell={shell} />
                <NavLinks items={NAV_BY_SHELL[shell]} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </ThemeProvider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3.5 text-[26px]">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-[11px] last:mb-0">{children}</div>;
}

function Palette() {
  const theme = useTheme();
  const entries: [string, string][] = [
    ["accent", theme.accent],
    ["ink", theme.ink],
    ["mist", theme.mist],
    ["blush", theme.blush],
    ["deep", theme.deep],
    ["line", theme.line],
    ["line2", theme.line2],
    ["stone", theme.stone],
    ["gold", theme.gold],
    ["gold-soft", theme.goldSoft],
    ["success", theme.success],
    ["danger", theme.danger],
  ];
  return (
    <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
      {entries.map(([name, hex]) => (
        <div key={name} className="rounded-[10px] border border-[#F3E4EC] bg-white p-2">
          <div className="h-10 rounded-[7px] border border-[#F3E4EC]" style={{ backgroundColor: hex }} />
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8E7C86]">{name}</div>
          <div className="font-mono text-[11px]">{hex}</div>
        </div>
      ))}
    </div>
  );
}
