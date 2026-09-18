import { StubPage } from "@/components/shell/StubPage";
import { loadTerms } from "@/lib/config/load";

export default async function Page() {
  const t = await loadTerms();
  return <StubPage eyebrow={t.admin} title={"Personalização"} phase="F4" />;
}
