"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CONTROLE } from "@/components/ui/Field";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { useTheme } from "@/components/theme/ThemeProvider";
import { aprovarCadastrosAcao, recusarCadastroAcao } from "@/lib/admin/acoes";
import { FORM_INICIAL } from "@/lib/forms";

/** O pedido já formatado pelo servidor: o cliente não formata data. */
export type PedidoParaDecidir = {
  id: string;
  nome: string;
  email: string;
  detalhe: string | null;
  telefone: string | null;
  linkedin: string | null;
  objetivo: string | null;
  quando: string;
  quandoCompleto: string;
  emailConfirmado: boolean;
  temLogin: boolean;
};

/**
 * A fila com seleção. Só pedido com e-mail confirmado pode ser marcado — o
 * servidor recusaria os outros de qualquer jeito, e a caixa desligada diz por
 * quê antes do clique.
 *
 * As duas respostas (aprovar e recusar) moram aqui em cima, e não na linha:
 * a linha decidida some com o `refresh()`, e levaria junto a frase que diz o
 * que acabou de acontecer. Pelo mesmo motivo o estado vazio é desenhado aqui,
 * abaixo da frase, e não pela página no lugar deste componente.
 */
export function FilaDeCadastros({
  pedidos,
  podeDecidir,
}: {
  pedidos: PedidoParaDecidir[];
  podeDecidir: boolean;
}) {
  const [aprovacao, aprovar, aprovando] = useActionState(
    aprovarCadastrosAcao,
    FORM_INICIAL,
  );
  const [recusa, recusar, recusando] = useActionState(
    recusarCadastroAcao,
    FORM_INICIAL,
  );
  const [, iniciar] = useTransition();
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [ultima, setUltima] = useState<"aprovacao" | "recusa" | null>(null);

  const elegiveis = pedidos
    .filter((p) => p.emailConfirmado && p.temLogin)
    .map((p) => p.id);
  // O que foi decidido sai da lista no `refresh()`; a seleção não pode guardar fantasma.
  const selecionados = elegiveis.filter((id) => marcados.has(id));
  const todos =
    elegiveis.length > 0 && selecionados.length === elegiveis.length;
  const ocupado = aprovando || recusando;

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function aprovarSelecionados() {
    const dados = new FormData();
    for (const id of selecionados) dados.append("pedido", id);
    setUltima("aprovacao");
    iniciar(() => aprovar(dados));
  }

  function recusarPedido(id: string, motivo: string) {
    const dados = new FormData();
    dados.set("pedido", id);
    dados.set("motivo", motivo);
    setUltima("recusa");
    iniciar(() => recusar(dados));
  }

  const retorno =
    ultima === "recusa" ? recusa : ultima === "aprovacao" ? aprovacao : null;

  return (
    <div className="flex flex-col gap-4">
      {retorno !== null && (
        <div className="flex flex-col gap-2">
          <FormFeedback erro={null} ok={retorno.ok} credencial={null} />
          <FormFeedback erro={retorno.erro} ok={null} credencial={null} />
        </div>
      )}

      {pedidos.length === 0 && (
        <EmptyState
          icone="user-check"
          title="Fila vazia"
          description="Quando alguém se cadastrar, o pedido aparece aqui — e só pode ser aprovado depois que a pessoa confirmar o e-mail."
        />
      )}

      {podeDecidir && pedidos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#FDF8FB] px-3.5 py-2.5">
          <label className="flex items-center gap-2.5 text-[13px] text-[#2A1B26]">
            <Caixa
              marcada={todos}
              desligada={elegiveis.length === 0 || ocupado}
              aoMudar={() =>
                setMarcados(todos ? new Set() : new Set(elegiveis))
              }
            />
            {elegiveis.length === 0
              ? "Nenhum pedido com e-mail confirmado"
              : `Selecionar os confirmados (${elegiveis.length})`}
          </label>
          <Button
            type="button"
            size="sm"
            disabled={selecionados.length === 0 || ocupado}
            onClick={aprovarSelecionados}
          >
            {aprovando
              ? "Aprovando…"
              : selecionados.length === 0
                ? "Aprovar selecionados"
                : `Aprovar ${selecionados.length === 1 ? "1 cadastro" : `${selecionados.length} cadastros`}`}
          </Button>
        </div>
      )}

      {pedidos.length > 0 && (
        <ul className="flex flex-col divide-y divide-[#F3E4EC]">
          {pedidos.map((pedido) => (
            <Linha
              key={pedido.id}
              pedido={pedido}
              podeDecidir={podeDecidir}
              marcada={marcados.has(pedido.id)}
              ocupado={ocupado}
              aoMarcar={() => alternar(pedido.id)}
              aoRecusar={(motivo) => recusarPedido(pedido.id, motivo)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Caixa({
  marcada,
  desligada,
  aoMudar,
  rotulo,
}: {
  marcada: boolean;
  desligada: boolean;
  aoMudar: () => void;
  rotulo?: string;
}) {
  const { accent } = useTheme();
  return (
    <input
      type="checkbox"
      checked={marcada}
      disabled={desligada}
      onChange={aoMudar}
      aria-label={rotulo}
      className="h-4 w-4 shrink-0 disabled:cursor-not-allowed"
      style={{ accentColor: accent }}
    />
  );
}

function Linha({
  pedido,
  podeDecidir,
  marcada,
  ocupado,
  aoMarcar,
  aoRecusar,
}: {
  pedido: PedidoParaDecidir;
  podeDecidir: boolean;
  marcada: boolean;
  ocupado: boolean;
  aoMarcar: () => void;
  aoRecusar: (motivo: string) => void;
}) {
  const { accent } = useTheme();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const elegivel = pedido.emailConfirmado && pedido.temLogin;

  return (
    <li className="flex gap-3 py-4 first:pt-1 last:pb-1">
      {podeDecidir && (
        <div className="pt-[3px]">
          <Caixa
            marcada={marcada && elegivel}
            desligada={!elegivel || ocupado}
            aoMudar={aoMarcar}
            rotulo={`Selecionar ${pedido.nome}`}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14.5px] font-semibold text-[#2A1B26]">
            {pedido.nome}
          </span>
          {!pedido.temLogin ? (
            <Pill variant="bad">Sem login</Pill>
          ) : pedido.emailConfirmado ? (
            <Pill variant="on">E-mail confirmado</Pill>
          ) : (
            <Pill variant="wait">Esperando confirmação</Pill>
          )}
          <span
            className="ml-auto font-mono text-[11px] text-[#8E7C86]"
            title={pedido.quandoCompleto}
          >
            {pedido.quando}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-[#8E7C86]">
          <span className="break-all">{pedido.email}</span>
          {pedido.telefone !== null && <span>{pedido.telefone}</span>}
          {pedido.linkedin !== null && (
            <a
              href={pedido.linkedin}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: accent }}
            >
              LinkedIn
              <Icone nome="chevron-right" tamanho={12} />
            </a>
          )}
          {pedido.detalhe !== null && (
            <span className="text-[#2A1B26]">{pedido.detalhe}</span>
          )}
        </div>

        {pedido.objetivo !== null && (
          <p className="whitespace-pre-line rounded-[10px] bg-[#FDF8FB] px-3 py-2.5 text-[13px] leading-[1.5] text-[#2A1B26]">
            {pedido.objetivo}
          </p>
        )}

        {podeDecidir &&
          (recusando ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-[#F2CFC8] p-3">
              <label
                htmlFor={`motivo-${pedido.id}`}
                className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]"
              >
                Motivo — só a equipe vê
              </label>
              <textarea
                id={`motivo-${pedido.id}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={ocupado}
                className={`${CONTROLE} resize-y`}
                placeholder="Opcional. Ex.: pedido em nome de empresa; e-mail de teste."
              />
              <p className="text-[12px] leading-[1.45] text-[#8E7C86]">
                Recusar apaga o login criado no cadastro. A pessoa pode pedir de
                novo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="warn"
                  disabled={ocupado}
                  onClick={() => aoRecusar(motivo)}
                >
                  Recusar pedido
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={ocupado}
                  autoFocus
                  onClick={() => {
                    setRecusando(false);
                    setMotivo("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={ocupado}
                onClick={() => setRecusando(true)}
              >
                Recusar
              </Button>
            </div>
          ))}
      </div>
    </li>
  );
}
