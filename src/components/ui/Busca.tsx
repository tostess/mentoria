"use client";

import { Icone } from "./Icone";

/**
 * Campo de busca das listas. A busca é filtro no cliente sobre o que a página
 * já trouxe (CLAUDE.md: sem serviço externo abaixo de 200 Parceiros).
 */
export function Busca({
  valor,
  aoMudar,
  rotulo,
  placeholder,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  rotulo: string;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-[200px] flex-1">
      <span className="sr-only">{rotulo}</span>
      <Icone
        nome="search"
        tamanho={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-line2 bg-surface py-[9px] pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-accent"
      />
    </label>
  );
}

/** Chip de filtro — escolha exclusiva dentro de um grupo. */
export function Chip({
  ativo,
  aoClicar,
  children,
}: {
  ativo: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={`rounded-[8px] border px-[11px] py-[6px] text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        ativo
          ? "border-transparent bg-blush font-semibold text-deep"
          : "border-line2 bg-surface text-stone hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Minúsculas e sem acento: "saude" acha "Saúde". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
