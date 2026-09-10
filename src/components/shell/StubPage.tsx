import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** Página vazia com título. Some conforme cada fase entrega a tela real. */
export function StubPage({ eyebrow, title, phase }: { eyebrow: string; title: string; phase: string }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <EmptyState title="Ainda não há nada aqui" description={`Esta tela chega na fase ${phase}.`} />
    </>
  );
}
