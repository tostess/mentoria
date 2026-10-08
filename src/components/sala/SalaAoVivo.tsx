"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Ficha, FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { cap } from "@/lib/terms";
import { mmss, relogio, type FaseDoRelogio } from "@/lib/video/relogio";

export type PresenteNaSala =
  | { papel: "partner"; cota: number; usados: number; dado: boolean; mes: string }
  | { papel: "professional"; recebido: boolean; saldo: number | null; tetoVisual: number };

type Props = {
  bookingId: string;
  /** Instantes em ISO; os textos de hora já vêm formatados no fuso de quem olha. */
  inicioIso: string;
  fimIso: string;
  fechaIso: string;
  /** Relógio do servidor no momento do render — corrige celular com hora errada. */
  agoraIso: string;
  intervalo: string;
  comecaAs: string;
  terminaAs: string;
  outro: { nome: string; primeiroNome: string; foto: string | null; linha: string | null };
  presente: PresenteNaSala;
};

type Video =
  | { fase: "abrindo" }
  | { fase: "pronto"; url: string }
  | { fase: "erro"; texto: string; podeTentar: boolean };

/**
 * A sala: o Prebuilt num iframe, o relógio nosso por fora dele, e o presente.
 *
 * O token é pedido ao montar e nunca guardado: o Prebuilt apaga o `?t=` depois
 * de ler, então recarregar a página é pedir outro. Quando o relógio chega ao
 * fechamento — o mesmo segundo em que o Daily expulsa pela expiração da sala —,
 * a página troca o vídeo pela tela de fim nossa, e a frase do Prebuilt ("você
 * foi removido da chamada") nunca fica na tela.
 */
export function SalaAoVivo(props: Props) {
  const { bookingId, outro } = props;
  const router = useRouter();
  const t = useTerms();

  const inicio = Date.parse(props.inicioIso);
  const fim = Date.parse(props.fimIso);
  const fecha = Date.parse(props.fechaIso);

  // Começa no relógio do servidor, igual nos dois lados da hidratação; o tique
  // soma o deslocamento entre ele e o do aparelho.
  const [agora, setAgora] = useState(() => Date.parse(props.agoraIso));
  useEffect(() => {
    const deslocamento = Date.parse(props.agoraIso) - Date.now();
    const id = setInterval(() => setAgora(Date.now() + deslocamento), 1000);
    return () => clearInterval(id);
  }, [props.agoraIso]);

  const estado = relogio(agora, inicio, fim, fecha);
  useEffect(() => {
    if (estado.fase === "fechada") router.replace(`/sala/${bookingId}/fim`);
  }, [estado.fase, router, bookingId]);

  const [video, setVideo] = useState<Video>({ fase: "abrindo" });
  const pedido = useRef(false);

  async function entrar() {
    try {
      const resposta = await fetch(`/api/sessoes/${bookingId}/entrar`, { method: "POST" });
      const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; erro?: string };
      if (resposta.ok && typeof corpo.url === "string") {
        setVideo({ fase: "pronto", url: corpo.url });
        return;
      }
      setVideo({
        fase: "erro",
        texto: corpo.erro ?? "Não foi possível abrir a sala agora.",
        podeTentar: resposta.status >= 500,
      });
    } catch {
      setVideo({ fase: "erro", texto: "Sem conexão. Confira a internet e tente de novo.", podeTentar: true });
    }
  }

  useEffect(() => {
    // Em desenvolvimento o React monta duas vezes; um token basta.
    if (pedido.current) return;
    pedido.current = true;
    void entrar();
    // `entrar` é estável o bastante: só lê `bookingId`, que não muda nesta página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- o presente chegando, do lado do Profissional
  const recebeu = props.presente.papel === "professional" && props.presente.recebido;
  const [recebido, setRecebido] = useState(recebeu);
  const [saldo, setSaldo] = useState(props.presente.papel === "professional" ? props.presente.saldo : null);
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    if (props.presente.papel !== "professional" || recebido) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/sessoes/${bookingId}/presente`, { cache: "no-store" });
        if (!r.ok) return;
        const c = (await r.json()) as { recebido?: boolean; saldo?: number | null };
        if (c.recebido) {
          setRecebido(true);
          if (typeof c.saldo === "number") setSaldo(c.saldo);
          setAviso(true);
        }
      } catch {
        // Sem rede agora: a próxima consulta tenta de novo.
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [props.presente.papel, recebido, bookingId]);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(false), 8000);
    return () => clearTimeout(id);
  }, [aviso]);

  return (
    <div className="grid h-[100dvh] min-h-[560px] grid-rows-[auto_1fr] bg-mist">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 lg:px-5">
        <Link
          href={`/sala/${bookingId}/fim`}
          className="inline-flex items-center gap-1.5 text-[13px] text-stone hover:text-accent"
        >
          <Icone nome="chevron-left" tamanho={14} />
          Sair
        </Link>
        <span className="hidden h-7 w-px bg-line sm:block" />
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={outro.nome} photoUrl={outro.foto} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">
              {cap(t.session)} com {outro.nome}
            </div>
            <div className="hidden font-mono text-[11px] text-stone sm:block">{props.intervalo}</div>
          </div>
        </div>
        <RelogioDaSala
          fase={estado.fase}
          segundos={estado.segundos}
          comecaAs={props.comecaAs}
          terminaAs={props.terminaAs}
        />
      </header>

      <div className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_300px] lg:gap-4 lg:p-5">
        <div className="relative min-h-[62vh] overflow-hidden rounded-[14px] bg-ink-night lg:min-h-0">
          {video.fase === "pronto" && (
            <iframe
              src={video.url}
              title={`Vídeo da ${t.session}`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
          {video.fase === "abrindo" && (
            <div className="grid h-full place-items-center p-6 text-center text-[13.5px] text-ghost">
              Abrindo a sala…
            </div>
          )}
          {video.fase === "erro" && (
            <div className="grid h-full place-items-center p-6">
              <div className="flex max-w-[360px] flex-col items-center gap-3 text-center">
                <Icone nome="alerta" tamanho={22} className="text-night-text" />
                <p className="text-[14px] text-night-text">{video.texto}</p>
                {video.podeTentar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setVideo({ fase: "abrindo" });
                      void entrar();
                    }}
                  >
                    Tentar de novo
                  </Button>
                )}
              </div>
            </div>
          )}

          {aviso && (
            <div
              role="status"
              className="presente-aviso absolute left-1/2 top-4 z-10 flex w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 items-center gap-3.5 rounded-[16px] bg-surface py-3.5 pl-3.5 pr-[18px] shadow-[0_18px_50px_-18px_rgba(0,0,0,0.55)]"
            >
              <Ficha size="l" className="presente-ficha" />
              <div>
                <b className="block font-display text-[22px] leading-[1.05]">
                  {outro.primeiroNome} te deu 1 {t.ficha}
                </b>
                <span className="text-[12.5px] text-stone">
                  Presente para você marcar a próxima conversa.
                </span>
              </div>
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3.5 lg:overflow-auto">
          <div className="hidden rounded-[14px] border border-line bg-surface p-4 lg:block">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone">Com você</div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <Avatar name={outro.nome} photoUrl={outro.foto} size="md" />
              <div className="min-w-0">
                <div className="font-semibold">{outro.nome}</div>
                {outro.linha && <div className="text-[12.5px] leading-[1.4] text-stone">{outro.linha}</div>}
              </div>
            </div>
          </div>

          {props.presente.papel === "partner" ? (
            <PainelDoPresente
              bookingId={bookingId}
              primeiroNome={outro.primeiroNome}
              inicial={props.presente}
              aberto={estado.fase !== "antes" && estado.fase !== "fechada"}
            />
          ) : (
            <div className="rounded-[14px] border border-line bg-surface p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone">Sua carteira</div>
              <div className="mt-2.5 flex items-center gap-2.5">
                {saldo !== null && saldo > 0 && (
                  <FichaStack count={saldo} max={props.presente.tetoVisual} />
                )}
                <b className="font-mono text-[20px] font-medium">{saldo ?? "—"}</b>
                <span className="text-[12.5px] text-stone">{saldo === 1 ? t.ficha : t.fichas}</span>
              </div>
              {recebido && (
                <p className="mt-3 text-[12.5px] text-gold-ink">
                  {outro.primeiroNome} te deu 1 {t.ficha} nesta {t.session}.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

const TOM: Record<FaseDoRelogio, string> = {
  antes: "border-line bg-mist text-ink",
  sessao: "border-line bg-mist text-ink",
  "reta-final": "border-transparent bg-gold-soft text-gold-text",
  tolerancia: "border-transparent bg-danger-soft text-danger",
  fechada: "border-line bg-mist text-stone",
};

function RelogioDaSala({
  fase,
  segundos,
  comecaAs,
  terminaAs,
}: {
  fase: FaseDoRelogio;
  segundos: number;
  comecaAs: string;
  terminaAs: string;
}) {
  const [rotulo, sub] =
    fase === "antes"
      ? ["Começa em", `às ${comecaAs}`]
      : fase === "sessao"
        ? ["Faltam", `termina às ${terminaAs}`]
        : fase === "reta-final"
          ? ["Termina em", `às ${terminaAs}`]
          : fase === "tolerancia"
            ? ["A sala fecha em", `passou das ${terminaAs}`]
            : ["Encerrada", ""];

  return (
    <div
      className={`ml-auto flex items-center gap-3 rounded-[12px] border px-3.5 pb-2 pt-[7px] ${TOM[fase]}`}
      aria-live="off"
    >
      <div className="font-mono text-[9.5px] uppercase leading-[1.25] tracking-[0.12em] opacity-80">
        {rotulo}
        {sub && (
          <span className="hidden font-sans text-[12px] font-medium normal-case tracking-normal sm:block">
            {sub}
          </span>
        )}
      </div>
      <div className="font-mono text-[22px] font-medium tabular-nums leading-none sm:text-[26px]">
        {fase === "fechada" ? "0:00" : mmss(segundos)}
      </div>
    </div>
  );
}

type EstadoDoPresente =
  | { fase: "parado" }
  | { fase: "confirmando" }
  | { fase: "enviando" }
  | { fase: "erro"; texto: string };

/**
 * O presente do Parceiro, em dois passos: o livro-caixa é imutável, e presente
 * dado não volta. A cota aparece como bolinhas — três por mês, não acumula.
 */
function PainelDoPresente({
  bookingId,
  primeiroNome,
  inicial,
  aberto,
}: {
  bookingId: string;
  primeiroNome: string;
  inicial: Extract<PresenteNaSala, { papel: "partner" }>;
  /** Da hora de início até a sala fechar. */
  aberto: boolean;
}) {
  const t = useTerms();
  const [cota, setCota] = useState({ cota: inicial.cota, usados: inicial.usados });
  const [dado, setDado] = useState(inicial.dado);
  const [agoraMesmo, setAgoraMesmo] = useState(false);
  const [estado, setEstado] = useState<EstadoDoPresente>({ fase: "parado" });
  const restantes = Math.max(0, cota.cota - cota.usados);

  async function presentear() {
    setEstado({ fase: "enviando" });
    try {
      const r = await fetch(`/api/sessoes/${bookingId}/presentear`, { method: "POST" });
      const c = (await r.json().catch(() => ({}))) as {
        cota?: number;
        usados?: number;
        erro?: string;
        motivo?: string;
      };
      if (r.ok && typeof c.cota === "number" && typeof c.usados === "number") {
        setCota({ cota: c.cota, usados: c.usados });
        setDado(true);
        setAgoraMesmo(true);
        setEstado({ fase: "parado" });
        return;
      }
      if (c.motivo === "ja-presenteou") {
        setDado(true);
        setEstado({ fase: "parado" });
        return;
      }
      if (c.motivo === "sem-cota") setCota((q) => ({ ...q, usados: q.cota }));
      setEstado({ fase: "erro", texto: c.erro ?? "Não foi possível registrar o presente agora." });
    } catch {
      setEstado({ fase: "erro", texto: "Sem conexão. Tente de novo." });
    }
  }

  const bolinhas = (
    <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-stone">
      <span className="inline-flex gap-1" aria-hidden="true">
        {Array.from({ length: cota.cota }, (_, i) => (
          <i
            key={i}
            className={`block h-2.5 w-2.5 rounded-full ${i < cota.usados ? "bg-line2" : "bg-gold"}`}
          />
        ))}
      </span>
      {restantes} de {cota.cota} em {inicial.mes}
    </div>
  );

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-stone">
        <Icone nome="presente" tamanho={13} />
        Presente
      </div>

      {dado ? (
        <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-gold-soft p-3.5">
          <Ficha size="l" className={agoraMesmo ? "presente-ficha" : ""} />
          <p className="text-[13px] text-gold-deep">
            <b className="text-gold-ink">
              Você deu 1 {t.ficha} para {primeiroNome}.
            </b>
            <br />
            {agoraMesmo ? `Aparece agora na tela de ${primeiroNome}.` : `Um presente por ${t.session}.`}
          </p>
        </div>
      ) : restantes === 0 ? (
        <>
          {bolinhas}
          <p className="mt-2 text-[12.5px] leading-[1.5] text-stone">
            Você já deu {cota.cota === 1 ? "o presente" : `os ${cota.cota} presentes`} de {inicial.mes}. A
            cota renova no mês que vem.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] leading-[1.5]">
            Gostou da conversa e quer que ela continue? Dê 1 {t.ficha} para {primeiroNome} marcar a
            próxima — com você ou com quem quiser.
          </p>
          {bolinhas}
          <div className="mt-3.5">
            {estado.fase === "confirmando" || estado.fase === "enviando" ? (
              <>
                <div className="mb-2.5 rounded-[12px] bg-gold-soft px-3.5 py-3 text-[13px] text-gold-deep">
                  Dar 1 {t.ficha} para {primeiroNome}? Sai da sua cota de {inicial.mes} e não pode ser
                  desfeito.
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="gold"
                    className="flex-1"
                    disabled={estado.fase === "enviando"}
                    onClick={() => void presentear()}
                  >
                    {estado.fase === "enviando" ? "Presenteando…" : "Presentear"}
                  </Button>
                  <Button
                    variant="ghost"
                    autoFocus
                    disabled={estado.fase === "enviando"}
                    onClick={() => setEstado({ fase: "parado" })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEstado({ fase: "parado" });
                    }}
                  >
                    Voltar
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="gold"
                className="w-full"
                disabled={!aberto}
                onClick={() => setEstado({ fase: "confirmando" })}
              >
                <Icone nome="presente" tamanho={15} />
                Presentear 1 {t.ficha}
              </Button>
            )}
            {!aberto && (
              <p className="mt-2 text-[12px] text-stone">O presente abre quando a {t.session} começar.</p>
            )}
            {estado.fase === "erro" && (
              <p role="alert" className="mt-2 text-[12px] text-danger">
                {estado.texto}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
