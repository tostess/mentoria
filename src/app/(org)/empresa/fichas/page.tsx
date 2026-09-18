import { StubPage } from "@/components/shell/StubPage";
import { loadTerms } from "@/lib/config/load";
import { cap } from "@/lib/terms";

export default async function Page() {
  const t = await loadTerms();
  return <StubPage eyebrow={t.orgAdmin} title={`${cap(t.fichas)} do contrato`} phase="F2" />;
}
