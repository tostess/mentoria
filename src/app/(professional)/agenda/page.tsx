import { StubPage } from "@/components/shell/StubPage";
import { terms } from "@/lib/terms";

export default function Page() {
  return <StubPage eyebrow={terms.professional} title={"Minha agenda"} phase="P4" />;
}
