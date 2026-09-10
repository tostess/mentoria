import { StubPage } from "@/components/shell/StubPage";
import { terms } from "@/lib/terms";

export default function Page() {
  return <StubPage eyebrow={terms.admin} title={"Painel"} phase="P1" />;
}
