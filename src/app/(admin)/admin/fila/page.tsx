import { StubPage } from "@/components/shell/StubPage";
import { terms } from "@/lib/terms";

export default function Page() {
  return <StubPage eyebrow={terms.admin} title={"Fila de decisões"} phase="F1.5" />;
}
