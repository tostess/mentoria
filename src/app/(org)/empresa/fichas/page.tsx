import { StubPage } from "@/components/shell/StubPage";
import { cap, terms } from "@/lib/terms";

export default function Page() {
  return <StubPage eyebrow={terms.orgAdmin} title={`${cap(terms.fichas)} do contrato`} phase="F2" />;
}
