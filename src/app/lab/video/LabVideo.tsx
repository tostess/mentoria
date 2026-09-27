"use client";

import { useEffect, useState } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Button, Card, CONTROLE, CONTROLE_MONO, ROTULO } from "@/components/ui";

/**
 * SPIKE P5-0 — bancada para medir o vídeo à mão, principalmente no celular.
 *
 * Três passos: criar a sala, emitir os dois tokens, entrar (em iframe nesta
 * página, ou no link direto do Daily). O painel de estado mostra `exp` da sala
 * e quem o Daily vê lá dentro, e o botão de estender prorroga a sala.
 */

type Sala = { name: string; url: string; config: Record<string, unknown> };
type Presenca = { total_count: number; data: Array<{ userName: string | null; joinTime: string }> };
type Emitido = { papel: "parceiro" | "profissional"; url: string };

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const corpo: unknown = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = (corpo as { erro?: unknown }).erro;
    throw new Error(typeof erro === "string" ? erro : `HTTP ${resposta.status}`);
  }
  return corpo as T;
}

function hora(segundos: unknown): string {
  if (typeof segundos !== "number") return "—";
  return new Date(segundos * 1000).toLocaleTimeString("pt-BR");
}

export function LabVideo() {
  const t = useTerms();
  const [nome, setNome] = useState("");
  const [expiraEmMin, setExpiraEmMin] = useState(45);
  const [ejetarNoFim, setEjetarNoFim] = useState(true);
  const [sala, setSala] = useState<Sala | null>(null);
  const [presenca, setPresenca] = useState<Presenca | null>(null);
  const [agora, setAgora] = useState(0);
  const [emitidos, setEmitidos] = useState<Emitido[]>([]);
  const [embutido, setEmbutido] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Token: janela em minutos a partir de agora.
  const [nbfEmMin, setNbfEmMin] = useState(-1);
  const [expEmMin, setExpEmMin] = useState(45);
  const [ejetarNoExp, setEjetarNoExp] = useState(false);
  const [prejoin, setPrejoin] = useState(true);

  async function agir(acao: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  const criar = () =>
    agir(async () => {
      const r = await chamar<{ sala: Sala; criada: boolean }>("/api/lab/video/sala", {
        method: "POST",
        body: JSON.stringify({ nome: nome || undefined, expiraEmMin, ejetarNoFim }),
      });
      setSala(r.sala);
      setNome(r.sala.name);
      setEmitidos([]);
      setEmbutido(null);
    });

  const emitir = (papel: "parceiro" | "profissional") =>
    agir(async () => {
      if (!sala) return;
      const r = await chamar<{ url: string }>("/api/lab/video/token", {
        method: "POST",
        body: JSON.stringify({
          sala: sala.name,
          papel,
          nome: papel === "parceiro" ? t.partner : t.professional,
          nbfEmMin,
          expEmMin,
          ejetarNoExp,
          prejoin,
        }),
      });
      setEmitidos((atual) => [...atual.filter((e) => e.papel !== papel), { papel, url: r.url }]);
    });

  const estender = (minutos: number) =>
    agir(async () => {
      if (!sala) return;
      const r = await chamar<{ sala: Sala }>("/api/lab/video/estender", {
        method: "POST",
        body: JSON.stringify({ sala: sala.name, minutos }),
      });
      setSala(r.sala);
    });

  // Estado da sala a cada 5 s enquanto houver sala.
  useEffect(() => {
    if (!sala) return;
    let vivo = true;
    const ler = async () => {
      try {
        const r = await chamar<{ sala: Sala; presenca: Presenca; agora: number }>(
          `/api/lab/video/sala?nome=${encodeURIComponent(sala.name)}`,
        );
        if (!vivo) return;
        setPresenca(r.presenca);
        setAgora(r.agora);
      } catch {
        // sala apagada ou sessão caiu: o próximo ciclo tenta de novo
      }
    };
    void ler();
    const id = setInterval(ler, 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [sala]);

  const exp = sala?.config.exp;
  const restante = typeof exp === "number" && agora > 0 ? exp - agora : null;

  return (
    <main className="mx-auto max-w-[960px] space-y-4 bg-[#FDF8FB] px-4 py-6 sm:px-6">
      <header>
        <p className={ROTULO}>Laboratório · descartável</p>
        <h1 className="text-[28px] font-bold text-[#2A1B26]">Vídeo — spike da P5</h1>
        <p className="text-[13.5px] text-[#8E7C86]">
          Sala privada, token por participante, extensão pela sala. Nada aqui grava no banco.
        </p>
      </header>

      {erro && (
        <p className="rounded-[10px] bg-[#FBEAE7] px-3 py-2 text-[13px] text-[#A63A2E]">{erro}</p>
      )}

      <Card title="1 · Sala">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className={ROTULO}>Nome (vazio sorteia um UUID)</span>
            <input className={CONTROLE_MONO} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="block">
            <span className={ROTULO}>Fim da sala em (min)</span>
            <input
              type="number"
              className={CONTROLE_MONO}
              value={expiraEmMin}
              onChange={(e) => setExpiraEmMin(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-[#2A1B26]">
          <input type="checkbox" checked={ejetarNoFim} onChange={(e) => setEjetarNoFim(e.target.checked)} />
          Expulsar todo mundo quando a sala vencer
        </label>
        <div className="mt-4">
          <Button onClick={criar} disabled={ocupado}>
            Criar ou reencontrar
          </Button>
        </div>
      </Card>

      {sala && (
        <Card title="Estado">
          <dl className="grid grid-cols-2 gap-3 font-mono text-[12.5px] sm:grid-cols-4">
            <div>
              <dt className={ROTULO}>Sala</dt>
              <dd className="break-all">{sala.name}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Vence às</dt>
              <dd>{hora(exp)}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Faltam</dt>
              <dd>{restante === null ? "—" : `${Math.floor(restante / 60)} min ${restante % 60} s`}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Dentro agora</dt>
              <dd>
                {presenca
                  ? `${presenca.total_count} — ${presenca.data.map((p) => p.userName ?? "?").join(", ") || "ninguém"}`
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gold" size="sm" onClick={() => estender(30)} disabled={ocupado}>
              Estender 30 min
            </Button>
            <Button variant="ghost" size="sm" onClick={() => estender(2)} disabled={ocupado}>
              Estender 2 min
            </Button>
          </div>
        </Card>
      )}

      {sala && (
        <Card title="2 · Tokens">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={ROTULO}>Pode entrar a partir de (min, negativo = já)</span>
              <input
                type="number"
                className={CONTROLE_MONO}
                value={nbfEmMin}
                onChange={(e) => setNbfEmMin(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className={ROTULO}>Não entra depois de (min)</span>
              <input
                type="number"
                className={CONTROLE_MONO}
                value={expEmMin}
                onChange={(e) => setExpEmMin(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="mt-3 space-y-2 text-[13px] text-[#2A1B26]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ejetarNoExp} onChange={(e) => setEjetarNoExp(e.target.checked)} />
              Expulsar quando o token vencer (anula a expulsão da sala para esta pessoa)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={prejoin} onChange={(e) => setPrejoin(e.target.checked)} />
              Tela de teste de câmera antes de entrar
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => emitir("parceiro")} disabled={ocupado}>
              Token de {t.partner} (dono)
            </Button>
            <Button variant="ghost" onClick={() => emitir("profissional")} disabled={ocupado}>
              Token de {t.professional}
            </Button>
          </div>

          {emitidos.length > 0 && (
            <ul className="mt-4 space-y-3">
              {emitidos.map((e) => (
                <li key={e.papel} className="rounded-[10px] border border-[#F3E4EC] p-3">
                  <p className={ROTULO}>{e.papel === "parceiro" ? t.partner : t.professional}</p>
                  <input readOnly className={`${CONTROLE} font-mono text-[11px]`} value={e.url} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setEmbutido(e.url)}>
                      Entrar aqui (iframe)
                    </Button>
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-[8px] border border-[#EAD6E1] px-3 py-[6px] text-[12.5px] font-semibold text-[#2A1B26]"
                    >
                      Abrir direto no Daily
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void navigator.clipboard?.writeText(e.url)}
                    >
                      Copiar link
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {embutido && (
        <Card
          title="3 · Chamada"
          action={
            <Button size="sm" variant="ghost" onClick={() => setEmbutido(null)}>
              Fechar
            </Button>
          }
        >
          {/*
            O `allow` é o que deixa o iframe pedir câmera e microfone. Sem ele o
            Safari do iPhone nega em silêncio. É o ponto a observar no celular.
          */}
          <iframe
            src={embutido}
            title="Chamada"
            allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
            className="h-[70vh] min-h-[420px] w-full rounded-[10px] border border-[#F3E4EC] bg-[#2A1B26]"
          />
        </Card>
      )}
    </main>
  );
}
