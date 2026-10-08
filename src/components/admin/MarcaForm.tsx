"use client";

import { useState, type CSSProperties } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Button } from "@/components/ui/Button";
import { CONTROLE, CONTROLE_MONO, Field, ROTULO } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { useEnvioSemReset } from "@/components/ui/useEnvioSemReset";
import { editarMarcaAcao } from "@/lib/admin/acoes";
import { mergeBranding } from "@/lib/config/app-config";
import { countFichas, type Terms } from "@/lib/terms";
import type { MarcaDaEmpresa } from "@/lib/marca/operacoes";
import { ROTULO_DA_COR, avisosDeContraste, problemasDeLeitura } from "@/lib/marca/regras";
import {
  CORES_DA_MARCA,
  normalizeHex,
  resolveTheme,
  variaveisDoTema,
  type AjustesDeCor,
  type Branding,
  type CorDaMarca,
  type Theme,
} from "@/lib/theme";

/**
 * A marca da empresa: cor principal, nome, logotipo e o ajuste fino das
 * outras cores, com a prévia ao lado.
 *
 * As outras cores saem da principal (`paletaDoAccent`), então o caso comum é
 * escolher uma cor só. O ajuste fino guarda apenas o que a operadora mexeu: a
 * cor não ajustada continua acompanhando a principal quando ela muda.
 *
 * Campos controlados, então envia por `onSubmit` — com `action`, o reset do
 * React 19 deixaria a prévia mostrando uma marca e o formulário outra.
 */
export function MarcaForm({
  orgId,
  atual,
  plataforma,
}: {
  orgId: string;
  atual: MarcaDaEmpresa;
  plataforma: Branding;
}) {
  const t = useTerms();
  const [estado, aoEnviar, enviando] = useEnvioSemReset(editarMarcaAcao);
  const [accentTexto, setAccentTexto] = useState(atual.accent ?? "");
  const [nomeNaMarca, setNomeNaMarca] = useState(atual.nomeNaMarca ?? "");
  const [logotipo, setLogotipo] = useState(atual.logotipo ?? "");
  const [ajustes, setAjustes] = useState<AjustesDeCor>(atual.cores);

  const accent = normalizeHex(accentTexto);
  const accentInvalido = accentTexto.trim() !== "" && accent === null;
  const tema = resolveTheme(
    mergeBranding(plataforma, {
      accent,
      name: nomeNaMarca.trim() || null,
      logoUrl: logotipo.trim() || null,
      cores: ajustes,
    }),
  );
  const problemas = problemasDeLeitura(tema);
  const avisos = avisosDeContraste(tema);
  const ajustadas = CORES_DA_MARCA.filter((cor) => ajustes[cor] !== undefined);

  function ajustar(cor: CorDaMarca, valor: string | undefined) {
    setAjustes((anteriores) => {
      const proximos = { ...anteriores };
      if (valor === undefined) delete proximos[cor];
      else proximos[cor] = valor.toUpperCase();
      return proximos;
    });
  }

  function voltarAPlataforma() {
    setAccentTexto("");
    setNomeNaMarca("");
    setLogotipo("");
    setAjustes({});
  }

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1fr_1fr]">
      <form onSubmit={aoEnviar} className="flex flex-col gap-3.5">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="accent" value={accentTexto} />
        {ajustadas.map((cor) => (
          <input key={cor} type="hidden" name={`cor_${cor}`} value={ajustes[cor]} />
        ))}
        <FormFeedback erro={estado.erro} ok={estado.ok} credencial={null} />

        <Field
          htmlFor="marca-accent"
          label="Cor principal"
          hint={
            accentInvalido
              ? "Use um hex como #2E6B52."
              : "Botões, links e o item ativo do menu. As outras cores saem dela."
          }
        >
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Escolher a cor principal"
              value={tema.accent.toLowerCase()}
              onChange={(e) => setAccentTexto(e.target.value.toUpperCase())}
              disabled={enviando}
              className="h-[42px] w-[52px] shrink-0 cursor-pointer rounded-[10px] border border-line2 bg-surface p-1"
            />
            <input
              id="marca-accent"
              value={accentTexto}
              onChange={(e) => setAccentTexto(e.target.value)}
              maxLength={9}
              disabled={enviando}
              placeholder="Da plataforma"
              aria-invalid={accentInvalido}
              className={CONTROLE_MONO}
            />
          </div>
        </Field>

        <Field
          htmlFor="marca-nome"
          label="Nome na marca"
          hint="O que aparece no topo do menu. Em branco, o nome da plataforma."
        >
          <input
            id="marca-nome"
            name="nomeNaMarca"
            value={nomeNaMarca}
            onChange={(e) => setNomeNaMarca(e.target.value)}
            maxLength={40}
            disabled={enviando}
            className={CONTROLE}
          />
        </Field>

        <Field
          htmlFor="marca-logo"
          label="Logotipo"
          hint="Endereço https de uma imagem quadrada. Em branco, a inicial do nome sobre a cor principal."
        >
          <input
            id="marca-logo"
            name="logotipo"
            type="url"
            value={logotipo}
            onChange={(e) => setLogotipo(e.target.value)}
            maxLength={500}
            disabled={enviando}
            placeholder="https://"
            className={CONTROLE}
          />
        </Field>

        <details className="rounded-[12px] border border-line px-3.5 py-3" open={ajustadas.length > 0}>
          <summary className="cursor-pointer text-[13.5px] font-semibold">
            Ajuste fino das cores
            <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-stone">
              {ajustadas.length === 0
                ? "todas derivadas"
                : ajustadas.length === 1
                  ? "1 ajustada"
                  : `${ajustadas.length} ajustadas`}
            </span>
          </summary>
          <p className="mt-2 text-[12px] leading-[1.45] text-stone">
            Cada cor sai da principal. Mexa só no que a marca da empresa pede; o resto continua
            acompanhando a principal.
          </p>
          <ul className="mt-3 flex flex-col">
            {(Object.keys(ROTULO_DA_COR) as CorDaMarca[]).map((cor) => {
              const ajustada = ajustes[cor] !== undefined;
              return (
                <li
                  key={cor}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-t border-line py-2 first:border-t-0"
                >
                  <input
                    type="color"
                    aria-label={ROTULO_DA_COR[cor]}
                    value={tema[cor].toLowerCase()}
                    onChange={(e) => ajustar(cor, e.target.value)}
                    disabled={enviando}
                    className="h-8 w-9 cursor-pointer rounded-[8px] border border-line2 bg-surface p-0.5"
                  />
                  <div>
                    <div className="text-[13px]">{ROTULO_DA_COR[cor]}</div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-stone">
                      {tema[cor]} · {ajustada ? "ajustada" : "derivada"}
                    </div>
                  </div>
                  {ajustada ? (
                    <button
                      type="button"
                      onClick={() => ajustar(cor, undefined)}
                      disabled={enviando}
                      className="rounded-[8px] px-2 py-1 text-[12px] text-stone hover:bg-mist hover:text-ink"
                    >
                      Derivar de novo
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        </details>

        {problemas.map((problema) => (
          <p key={problema} className="flex gap-2 text-[12.5px] leading-[1.45] text-danger">
            <Icone nome="alerta" tamanho={15} className="mt-px shrink-0" />
            {problema}
          </p>
        ))}
        {avisos.map((aviso) => (
          <p key={aviso} className="flex gap-2 text-[12.5px] leading-[1.45] text-stone-dark">
            <Icone nome="info" tamanho={15} className="mt-px shrink-0" />
            {aviso}
          </p>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={enviando || accentInvalido || problemas.length > 0}>
            {enviando ? "Salvando…" : "Salvar marca"}
          </Button>
          <Button type="button" variant="ghost" onClick={voltarAPlataforma} disabled={enviando}>
            Voltar à marca da plataforma
          </Button>
        </div>
      </form>

      <div className="lg:sticky lg:top-6">
        <div className={ROTULO}>Prévia</div>
        <PreviaDaMarca tema={tema} t={t} />
        <p className="mt-2 text-[12px] leading-[1.45] text-stone">
          É o que o RH e os colaboradores desta {t.org.toLowerCase()} veem. A operadora e os{" "}
          {t.partners} continuam com a marca da plataforma.
        </p>
      </div>
    </div>
  );
}

/**
 * Um pedaço da casca com as variáveis da marca escritas no próprio `div`: as
 * classes são as mesmas da aplicação, e as variáveis do `div` vencem as do
 * `<html>`. O ouro e o verde de sucesso não mudam, de propósito.
 */
function PreviaDaMarca({ tema, t }: { tema: Theme; t: Terms }) {
  return (
    <div
      style={variaveisDoTema(tema) as CSSProperties}
      className="overflow-hidden rounded-[14px] border border-line bg-mist text-ink"
    >
      <div className="grid grid-cols-[150px_1fr] max-sm:grid-cols-1">
        <div className="flex flex-col gap-4 border-r border-line bg-surface p-3 max-sm:border-b max-sm:border-r-0">
          <div className="flex items-center gap-2">
            {tema.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logotipo da empresa, domínio variável
              <img src={tema.logoUrl} alt="" className="h-7 w-7 rounded-[8px] object-cover" />
            ) : (
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-accent font-mono text-[12px] font-semibold text-on-accent">
                {tema.platformName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-[17px] font-bold leading-none">
                {tema.platformName}
              </div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted">
                {t.professional}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-px text-[12px]">
            <span className="flex items-center gap-2 rounded-[8px] bg-accent-10 px-2 py-1.5 font-semibold text-on-soft">
              <Icone nome="home" tamanho={14} />
              Início
            </span>
            <span className="flex items-center gap-2 px-2 py-1.5 text-stone">
              <Icone nome="search" tamanho={14} className="text-faint" />
              {t.partners}
            </span>
            <span className="flex items-center gap-2 px-2 py-1.5 text-stone">
              <Icone nome="calendar" tamanho={14} className="text-faint" />
              Agenda
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-3.5">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-stone">Quinta, 9 de outubro</div>
            <div className="font-display text-[22px] font-bold leading-tight">Olá, Mariana</div>
          </div>
          <div className="rounded-[12px] border border-line bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold">Próxima {t.session.toLowerCase()}</span>
              <span className="rounded-full bg-accent-12 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-on-soft">
                Confirmada
              </span>
            </div>
            <p className="mt-1 text-[12px] text-stone">Sexta, 14h00 · 30 minutos</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="rounded-[9px] bg-accent px-3 py-1.5 text-[12px] font-semibold text-on-accent">
                Entrar na sala
              </span>
              <span className="text-[12px] font-semibold text-accent">Ver agenda</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface p-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-soft text-gold">
              <Icone nome="coins" tamanho={14} />
            </span>
            <span className="text-[12px] text-stone">
              <strong className="text-ink">{countFichas(2, t)}</strong> na carteira
            </span>
          </div>
          <div className="rounded-[10px] border border-line2 bg-surface px-2.5 py-2 text-[12px] text-faint">
            Buscar por área ou nome…
          </div>
        </div>
      </div>
    </div>
  );
}
