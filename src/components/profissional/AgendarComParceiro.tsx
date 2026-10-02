"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ficha, FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { useTheme } from "@/components/theme/ThemeProvider";
import { onAccent } from "@/lib/theme";
import { cap } from "@/lib/terms";

export type HorarioOferecido = { inicio: string; hora: string; fim: string };
export type DiaOferecido = {
  chave: string;
  semana: string;
  data: string;
  horarios: HorarioOferecido[];
};

type Termos = { ficha: string; fichas: string; sessao: string };

type Props = {
  partnerId: string;
  primeiroNome: string;
  dias: DiaOferecido[];
  rotuloDoFuso: string;
  saldo: number;
  preco: number;
  tetoCarteira: number;
  pendentes: number;
  maxPendentes: number;
  confirmaSozinho: boolean;
  horasParaResponder: number;
  duracaoMin: number;
  termos: Termos;
  /**
   * De onde vem a ficha, numa frase: o RH da empresa ou o pacote da conta
   * pessoal. Escrita no servidor, que sabe o tipo da conta pelo token.
   */
  deOndeVemAFicha: string;
};

type Estado =
  | { fase: "escolhendo" }
  | { fase: "enviando" }
  | { fase: "feito"; confirmada: boolean; saldo: number }
  | { fase: "recusado"; erro: string };

type Escolha = { dia: DiaOferecido; horario: HorarioOferecido };

function fichas(n: number, t: Termos): string {
  return `${n} ${n === 1 ? t.ficha : t.fichas}`;
}

/**
 * A grade de horários e a confirmação da reserva.
 *
 * Todo horário aqui saiu do motor, no servidor (invariante 14); o cliente só
 * escolhe. O instante vai para `POST /api/bookings` em ISO **com fuso**, e a
 * reserva recalcula a agenda antes de escrever — o que a tela mostrou é palpite.
 * Quando a resposta é recusa, a página é recarregada: o horário que alguém
 * acabou de tomar some da grade, e a frase do servidor fica no cartão.
 */
export function AgendarComParceiro(props: Props) {
  const { dias, termos: t } = props;
  const router = useRouter();
  const theme = useTheme();
  const [escolhido, setEscolhido] = useState<Escolha | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "escolhendo" });
  const cartaoRef = useRef<HTMLDivElement>(null);

  /**
   * No celular o cartão fica abaixo da grade, fora da vista depois do toque.
   * Rolar até ele é o que diz "agora confirme aqui" — sem animação, que o
   * sistema de design reserva para presente e extensão.
   */
  function escolher(escolha: Escolha) {
    setEscolhido(escolha);
    setEstado({ fase: "escolhendo" });
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => cartaoRef.current?.scrollIntoView({ block: "start" }));
    }
  }

  // Conferência de conveniência, para não oferecer um botão que certamente
  // falha. Quem decide é a reserva, no servidor.
  const bloqueio =
    props.saldo < props.preco
      ? `Você não tem ${t.ficha} para esta ${t.sessao}. ${props.deOndeVemAFicha}`
      : props.pendentes >= props.maxPendentes
        ? `Você já tem ${props.pendentes} pedidos esperando resposta. O limite é ${props.maxPendentes}.`
        : null;

  async function agendar(escolha: Escolha) {
    setEstado({ fase: "enviando" });
    try {
      const resposta = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partnerId: props.partnerId, inicio: escolha.horario.inicio }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as {
        status?: string;
        saldo?: number;
        erro?: string;
      };
      if (resposta.status === 201) {
        setEstado({
          fase: "feito",
          confirmada: corpo.status === "confirmed",
          saldo: corpo.saldo ?? props.saldo - props.preco,
        });
        router.refresh();
        return;
      }
      setEstado({ fase: "recusado", erro: corpo.erro ?? "Não foi possível agendar agora." });
      if (resposta.status === 409) {
        setEscolhido(null);
        router.refresh();
      }
    } catch {
      setEstado({ fase: "recusado", erro: "Sem conexão. Tente de novo." });
    }
  }

  const travado = estado.fase === "enviando" || estado.fase === "feito";

  const grade = (
    <Card
      title="Horários livres"
      icone="calendar"
      action={
        <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[#8E7C86]">
          <Icone nome="fuso" tamanho={13} />
          {props.rotuloDoFuso}
        </span>
      }
    >
      {dias.length === 0 ? (
        <EmptyState
          icone="calendar"
          title="Sem horário livre agora"
          description={`${props.primeiroNome} não tem horário aberto nas próximas semanas. Vale olhar de novo em alguns dias.`}
        />
      ) : (
        <div className="flex flex-col">
          {dias.map((dia) => (
            <div
              key={dia.chave}
              className="grid grid-cols-1 gap-2 border-t border-[#F3E4EC] py-3 first:border-t-0 first:pt-0 sm:grid-cols-[118px_1fr] sm:gap-3.5"
            >
              <div>
                <div className="text-[13.5px] font-semibold capitalize">{dia.semana}</div>
                <div className="font-mono text-[10.5px] text-[#8E7C86]">{dia.data}</div>
              </div>
              <div className="flex flex-wrap gap-[7px]">
                {dia.horarios.map((h) => {
                  const ativo = escolhido?.horario.inicio === h.inicio;
                  return (
                    <button
                      key={h.inicio}
                      type="button"
                      aria-pressed={ativo}
                      disabled={travado}
                      onClick={() => escolher({ dia, horario: h })}
                      className={`rounded-[8px] border px-[11px] py-[7px] font-mono text-[12.5px] transition-colors disabled:cursor-not-allowed ${
                        ativo
                          ? "border-transparent"
                          : "border-[#EAD6E1] bg-white hover:border-[#C2317A] hover:text-[#C2317A]"
                      }`}
                      style={
                        ativo
                          ? { backgroundColor: theme.accent, color: onAccent(theme.accent) }
                          : undefined
                      }
                    >
                      {h.hora}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  let cartao: ReactNode;
  if (estado.fase === "feito") {
    cartao = (
      <Card>
        <div className="flex gap-2.5 rounded-[12px] border border-[#CDE6DA] bg-[#EAF6F0] px-3.5 py-3 text-[13.5px] text-[#2E6B52]">
          <Icone nome="check" tamanho={16} className="mt-0.5 shrink-0" />
          <div>
            <b>{estado.confirmada ? `${cap(t.sessao)} confirmada` : "Pedido enviado"}</b>
            <br />
            {estado.confirmada
              ? "A confirmação é automática: já está na sua agenda."
              : `${props.primeiroNome} tem até ${props.horasParaResponder} horas para confirmar. Se não responder, a ${t.ficha} volta para você.`}
          </div>
        </div>
        {escolhido && (
          <dl className="mt-3.5 flex flex-col text-[13.5px]">
            <Linha
              rotulo="Quando"
              valor={
                <span className="capitalize">{`${escolhido.dia.semana}, ${escolhido.dia.data} · ${escolhido.horario.hora}`}</span>
              }
            />
            <Linha
              rotulo="Seu saldo agora"
              valor={<span className="font-mono">{fichas(estado.saldo, t)}</span>}
            />
          </dl>
        )}
        <Link
          href="/agenda"
          className="mt-3 flex w-full items-center justify-center rounded-[10px] border border-[#EAD6E1] bg-white px-[17px] py-[10px] text-[13.5px] font-semibold hover:border-[#FCEDF4] hover:bg-[#FCEDF4]"
        >
          Ver minha agenda
        </Link>
      </Card>
    );
  } else if (escolhido === null) {
    cartao = (
      <Card title="Agendar">
        <p className="text-[12.5px] leading-[1.5] text-[#8E7C86]">
          Escolha um horário. A {t.sessao} dura {props.duracaoMin} minutos e custa{" "}
          <b className="text-[#2A1B26]">{fichas(props.preco, t)}</b>.
        </p>
        {estado.fase === "recusado" && <Erro texto={estado.erro} />}
        <dl className="mt-3 flex flex-col text-[13.5px]">
          <Linha
            rotulo="Seu saldo"
            valor={
              <span className="inline-flex items-center gap-2">
                {props.saldo > 0 && <FichaStack count={props.saldo} max={props.tetoCarteira} />}
                <span className="font-mono">{props.saldo}</span>
              </span>
            }
          />
          <Linha
            rotulo="Pedidos esperando resposta"
            valor={<span className="font-mono">{`${props.pendentes} de ${props.maxPendentes}`}</span>}
          />
        </dl>
        {bloqueio && <p className="mt-3 text-[12.5px] leading-[1.5] text-[#A63A2E]">{bloqueio}</p>}
      </Card>
    );
  } else {
    const escolha = escolhido;
    cartao = (
      <Card>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">
          Você escolheu
        </div>
        <div className="mt-1.5 font-display text-[30px] font-bold capitalize leading-none">
          {escolha.dia.semana}, {escolha.dia.data}
        </div>
        <div className="mt-1 font-mono text-[12px] text-[#8E7C86]">
          {escolha.horario.hora}–{escolha.horario.fim} · {props.rotuloDoFuso}
        </div>
        <dl className="my-3.5 flex flex-col text-[13.5px]">
          <Linha rotulo="Com" valor={props.primeiroNome} />
          <Linha
            rotulo="Custa"
            valor={
              <span className="inline-flex items-center gap-2">
                <Ficha size="s" />
                {fichas(props.preco, t)}
              </span>
            }
          />
          <Linha
            rotulo="Saldo depois"
            valor={<span className="font-mono">{fichas(Math.max(0, props.saldo - props.preco), t)}</span>}
          />
          <Linha
            rotulo="Confirmação"
            valor={props.confirmaSozinho ? "Na hora" : `Em até ${props.horasParaResponder} h`}
          />
        </dl>
        {estado.fase === "recusado" && <Erro texto={estado.erro} />}
        {bloqueio ? (
          <p className="text-[12.5px] leading-[1.5] text-[#A63A2E]">{bloqueio}</p>
        ) : (
          <Button
            className="w-full"
            onClick={() => agendar(escolha)}
            disabled={estado.fase === "enviando"}
          >
            {estado.fase === "enviando" ? "Agendando…" : `Agendar e usar ${fichas(props.preco, t)}`}
          </Button>
        )}
        <p className="mt-2.5 text-[12.5px] leading-[1.5] text-[#8E7C86]">
          Se {props.primeiroNome} não puder atender ou não responder, a {t.ficha} volta para você.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
      {grade}
      <div ref={cartaoRef} className="scroll-mt-4 lg:sticky lg:top-6">
        {cartao}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[#F3E4EC] py-[9px] first:border-t-0">
      <dt className="text-[#8E7C86]">{rotulo}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <div
      role="alert"
      className="my-3 flex gap-2.5 rounded-[12px] bg-[#FBEAE7] px-3.5 py-3 text-[13.5px] text-[#A63A2E]"
    >
      <Icone nome="alerta" tamanho={16} className="mt-0.5 shrink-0" />
      <div>{texto}</div>
    </div>
  );
}
