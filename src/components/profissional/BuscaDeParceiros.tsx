"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Busca, Chip, normalizar } from "@/components/ui/Busca";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Tag } from "@/components/ui/Tag";

export type CartaoDeParceiro = {
  id: string;
  nome: string;
  foto: string | null;
  chamada: string | null;
  areas: string[];
  /** Tudo o que a busca por texto enxerga, já normalizado no servidor não — aqui. */
  textoDeBusca: string;
  /** `ter, 29/09 · 10:00`, já no fuso do Profissional; null sem horário no horizonte. */
  proximo: string | null;
  /** Para ordenar: instante do primeiro horário, ou infinito. */
  ordem: number;
};

/**
 * Filtro no cliente sobre a lista de ativos que a página trouxe — sem serviço
 * de busca (CLAUDE.md, abaixo de 200 Parceiros).
 *
 * Quem tem horário mais cedo vem primeiro; quem não tem nenhum no horizonte
 * continua na lista, no fim. Pessoa antes de horário, no espírito da
 * invariante 14.
 */
export function BuscaDeParceiros({
  parceiros,
  termoPlural,
  horizonteDias,
}: {
  parceiros: CartaoDeParceiro[];
  termoPlural: string;
  horizonteDias: number;
}) {
  const [texto, setTexto] = useState("");
  const [area, setArea] = useState<string | null>(null);

  const areas = useMemo(
    () => [...new Set(parceiros.flatMap((p) => p.areas))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [parceiros],
  );

  const visiveis = useMemo(() => {
    const q = normalizar(texto.trim());
    return parceiros
      .filter((p) => area === null || p.areas.includes(area))
      .filter((p) => q === "" || normalizar(p.textoDeBusca).includes(q))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [parceiros, texto, area]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Busca
          valor={texto}
          aoMudar={setTexto}
          rotulo={`Buscar ${termoPlural}`}
          placeholder="Buscar por nome, área ou assunto"
        />
      </div>
      {areas.length > 1 && (
        <div className="mb-[18px] flex flex-wrap gap-2">
          <Chip ativo={area === null} aoClicar={() => setArea(null)}>
            Todas as áreas
          </Chip>
          {areas.map((a) => (
            <Chip key={a} ativo={area === a} aoClicar={() => setArea(area === a ? null : a)}>
              {a}
            </Chip>
          ))}
        </div>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          icone="search"
          title={parceiros.length === 0 ? `Nenhum ${termoPlural} disponível ainda` : "Ninguém com esse termo"}
          description={parceiros.length === 0 ? "Volte em breve." : "Tente outra área ou apague a busca."}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((p) => (
            <li key={p.id}>
              <Link
                href={`/parceiros/${p.id}`}
                className="group flex h-full flex-col gap-3 rounded-[14px] border border-[#F3E4EC] bg-white p-[18px] transition-[border-color,box-shadow] duration-150 hover:border-[#EAD6E1] hover:shadow-[0_10px_30px_-22px_rgba(42,27,38,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2317A]"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.nome} photoUrl={p.foto} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{p.nome}</div>
                    {p.chamada && (
                      <div className="text-[12.5px] leading-[1.35] text-[#8E7C86]">{p.chamada}</div>
                    )}
                  </div>
                </div>
                {p.areas.length > 0 && (
                  <div className="flex flex-wrap gap-[5px]">
                    {p.areas.map((a) => (
                      <Tag key={a}>{a}</Tag>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#F3E4EC] pt-[11px] text-[12.5px] text-[#8E7C86]">
                  {p.proximo ? (
                    <>
                      <span>Próximo horário</span>
                      <span className="ml-auto font-mono text-[12px] text-[#2A1B26]">{p.proximo}</span>
                    </>
                  ) : (
                    <span>Sem horário nos próximos {horizonteDias} dias</span>
                  )}
                  <Icone
                    nome="chevron-right"
                    tamanho={15}
                    className="text-[#D9C3CF] group-hover:text-[#C2317A]"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
