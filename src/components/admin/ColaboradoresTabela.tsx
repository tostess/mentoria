"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTerms } from "@/components/config/TermsProvider";
import { Busca, Chip, normalizar } from "@/components/ui/Busca";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Pill } from "@/components/ui/Pill";
import { CellStack, Table, Td, Th } from "@/components/ui/Table";
import type { Colaborador } from "@/lib/admin/tipos";
import { cap } from "@/lib/terms";

/** A data chega formatada do servidor — invariante 2, conversão na borda. */
export type LinhaDeColaborador = Omit<Colaborador, "ultimoUso"> & { ultimoUso: string };

type Filtro = "todos" | "sem-ficha" | "inativos";

/**
 * Colaboradores da empresa, com busca e dois recortes que a operadora usa de
 * verdade: quem está sem ficha (precisa de alocação) e quem está com o acesso
 * desligado.
 */
export function ColaboradoresTabela({
  orgId,
  colaboradores,
  teto,
}: {
  orgId: string;
  colaboradores: LinhaDeColaborador[];
  teto: number;
}) {
  const t = useTerms();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return colaboradores.filter((p) => {
      if (filtro === "sem-ficha" && p.saldo > 0) return false;
      if (filtro === "inativos" && p.ativo) return false;
      if (termo === "") return true;
      return normalizar(`${p.nome} ${p.email} ${p.cargo ?? ""}`).includes(termo);
    });
  }, [colaboradores, busca, filtro]);

  const limpar = () => {
    setBusca("");
    setFiltro("todos");
  };

  return (
    <div className="flex flex-col gap-3.5">
      {colaboradores.length > 3 && (
        <div className="flex flex-wrap items-center gap-2">
          <Busca
            valor={busca}
            aoMudar={setBusca}
            rotulo="Buscar colaborador"
            placeholder="Buscar por nome, e-mail ou cargo"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar colaboradores">
            <Chip ativo={filtro === "todos"} aoClicar={() => setFiltro("todos")}>
              Todos
            </Chip>
            <Chip ativo={filtro === "sem-ficha"} aoClicar={() => setFiltro("sem-ficha")}>
              Sem {t.ficha}
            </Chip>
            <Chip ativo={filtro === "inativos"} aoClicar={() => setFiltro("inativos")}>
              Inativos
            </Chip>
          </div>
        </div>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          icone="search"
          title="Nenhum resultado"
          description={
            busca.trim() === ""
              ? "Ninguém nesta situação."
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
              <Th>Pessoa</Th>
              <Th>Cargo</Th>
              <Th align="right">{cap(t.fichas)}</Th>
              <Th>Último uso</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((pessoa) => (
              <tr
                key={pessoa.id}
                className="group relative transition-colors hover:bg-mist focus-within:bg-mist"
              >
                <Td>
                  <div className="flex items-center gap-2">
                    <CellStack
                      title={
                        <Link
                          href={`/admin/empresas/${orgId}/pessoas/${pessoa.id}`}
                          className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                        >
                          {pessoa.nome}
                        </Link>
                      }
                      sub={pessoa.email}
                    />
                    {!pessoa.ativo && <Pill variant="off">Inativo</Pill>}
                  </div>
                </Td>
                <Td>
                  <span className="text-[13px]">{pessoa.cargo ?? "—"}</span>
                </Td>
                <Td align="right">
                  {pessoa.saldo === 0 ? (
                    <span className="text-[12px] text-stone">sem {t.ficha}</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <FichaStack count={pessoa.saldo} max={teto} />
                      <span className="font-mono tabular-nums">{pessoa.saldo}</span>
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="font-mono text-[12px] text-stone">{pessoa.ultimoUso}</span>
                </Td>
                <Td align="right" className="w-8">
                  <Icone
                    nome="chevron-right"
                    className="text-ghost transition-colors group-hover:text-accent"
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
