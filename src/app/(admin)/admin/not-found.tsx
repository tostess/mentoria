import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";

/**
 * Id que não existe — link velho, endereço digitado errado, pessoa de outra
 * empresa. Fica dentro da casca, com caminho de volta, em vez do 404 genérico
 * que tira a pessoa do sistema.
 */
export default function NaoEncontrado() {
  return (
    <div className="pt-10">
      <EmptyState
        icone="search"
        title="Não encontramos esta página"
        description="O endereço pode estar incompleto, ou o registro não existe mais."
        action={
          <ButtonLink href="/admin/painel" variant="ghost">
            <Icone nome="dashboard" />
            Voltar ao painel
          </ButtonLink>
        }
      />
    </div>
  );
}
