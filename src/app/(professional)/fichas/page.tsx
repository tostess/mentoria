import { StubPage } from "@/components/shell/StubPage";
import { terms } from "@/lib/terms";

export default function Page() {
  return <StubPage eyebrow={terms.professional} title={`Minhas ${terms.fichas}`} phase="P3" />;
}
