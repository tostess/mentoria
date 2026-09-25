"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Busca, Chip, normalizar } from "@/components/ui/Busca";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import type { ParceiroNaLista } from "@/lib/admin/tipos";
import { corDoStatus, rotuloDoStatus, rotuloDoVinculo } from "@/lib/admin/rotulos";

const FILTROS = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "active", rotulo: "Ativos" },
  { valor: "paused", rotulo: "Pausados" },
  { valor: "archived", rotulo: "Arquivados" },
] as const;

type Filtro = (typeof FILTROS)[number]["valor"];

/**
 * A lista de Parceiros com busca por nome, e-mail, chamada ou área, e filtro
 * por status. A linha inteira leva ao detalhe — o link de verdade é o nome,
 * esticado sobre a linha, para meio-clique e leitor de tela funcionarem.
 */
export function ParceirosTabela({ parceiros }: { parceiros: ParceiroNaLista[] }) {
  const t = useTerms();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return parceiros.filter((p) => {
      if (filtro !== "todos" && p.status !== filtro) return false;
      if (termo === "") return true;
      return normalizar([p.nome, p.email, p.headline ?? "", ...p.areas].join(" ")).includes(termo);
    });
  }, [parceiros, busca, filtro]);

  const limpar = () => {
    setBusca("");
    setFiltro("todos");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Busca
          valor={busca}
          aoMudar={setBusca}
          rotulo={`Buscar ${t.partner}`}
          placeholder="Buscar por nome, e-mail ou área"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por status">
          {FILTROS.map((f) => (
            <Chip key={f.valor} ativo={filtro === f.valor} aoClicar={() => setFiltro(f.valor)}>
              {f.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icone="search"
          title="Nenhum resultado"
          description={
            busca.trim() === ""
              ? "Nenhum nesta situação."
              : `Nada encontrado para “${busca.trim()}”.`
          }
          action={
            <Button type="button" variant="ghost" size="sm" onClick={limpar}>
              Limpar filtro
            </Button>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t.partner}</Th>
              <Th>Áreas</Th>
              <Th>Vínculo</Th>
              <Th align="right">{t.sessions}</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((parceiro) => (
              <tr
                key={parceiro.id}
                className="group relative transition-colors hover:bg-[#FDF8FB] focus-within:bg-[#FDF8FB]"
              >
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={parceiro.nome} size="sm" />
                    <CellStack
                      title={
                        <Link
                          href={`/admin/parceiros/${parceiro.id}`}
                          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                        >
                          {parceiro.nome}
                        </Link>
                      }
                      sub={parceiro.headline ?? parceiro.email}
                    />
                  </div>
                </Td>
                <Td>
                  {parceiro.areas.length === 0 ? (
                    <span className="text-[12px] text-[#8E7C86]">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {parceiro.areas.map((area) => (
                        <Tag key={area}>{area}</Tag>
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="text-[12.5px] text-[#8E7C86]">
                    {rotuloDoVinculo(parceiro.engajamento)}
                  </span>
                </Td>
                <Td align="right">
                  <span className="font-mono tabular-nums">{parceiro.sessoes}</span>
                </Td>
                <Td>
                  <Pill variant={corDoStatus(parceiro.status)}>
                    {rotuloDoStatus(parceiro.status)}
                  </Pill>
                </Td>
                <Td align="right" className="w-8">
                  <Icone
                    nome="chevron-right"
                    className="text-[#D9C3CF] transition-colors group-hover:text-[#C2317A]"
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
