import Link from "next/link";
import { Fragment } from "react";
import { Icone } from "@/components/ui/Icone";

export type Migalha = { rotulo: string; href?: string };

/**
 * A trilha de onde se está: "Empresas › Faculdade Aurora › Mariana Costa".
 * Entra no `eyebrow` do `PageHeader`, no lugar do rótulo do papel, em toda
 * tela que fica mais de um nível abaixo da navegação.
 *
 * O último item não é link — é a página atual, e link para si mesmo só
 * recarrega.
 */
export function Migalhas({ itens }: { itens: Migalha[] }) {
  return (
    <nav aria-label="Trilha">
      <ol className="flex flex-wrap items-center gap-1">
        {itens.map((item, i) => (
          <Fragment key={`${item.rotulo}-${i}`}>
            {i > 0 && (
              <li aria-hidden className="text-ghost">
                <Icone nome="chevron-right" tamanho={11} />
              </li>
            )}
            <li className="max-w-[28ch] truncate">
              {item.href === undefined ? (
                <span aria-current="page">{item.rotulo}</span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-accent">
                  {item.rotulo}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
