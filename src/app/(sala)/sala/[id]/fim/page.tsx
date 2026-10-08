import { ButtonLink } from "@/components/ui/ButtonLink";
import { Ficha } from "@/components/ui/Ficha";
import { Portao } from "@/components/sala/Portao";
import { SairDoIframe } from "@/components/sala/SairDoIframe";
import { requireRole } from "@/lib/auth/session";
import { presenteNaSala } from "@/lib/bookings";
import { loadAppConfig } from "@/lib/config/load";
import { hora, intervalo } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { cap } from "@/lib/terms";
import { carregarSala, presenteRecebido } from "@/lib/video/dados";
import { primeiroNome, porta } from "@/lib/video/sala";

export const metadata = { title: "Fim da sessão" };

/**
 * A tela de fim, nossa. Chega-se aqui de três jeitos: o relógio da sala passou
 * do fechamento, a pessoa clicou em "Sair" no topo, ou clicou em sair dentro do
 * Prebuilt — e aí esta página carrega dentro do iframe e sobe para a janela de
 * cima (`SairDoIframe`).
 *
 * Se a sala ainda está aberta, a saída pode ter sido sem querer: a tela diz até
 * quando ela fica aberta e oferece a volta.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("professional", "partner");
  const papel = sessao.role === "partner" ? "partner" : "professional";
  const inicio = papel === "partner" ? "/parceiro/sessoes" : "/inicio";
  const config = await loadAppConfig();
  const t = config.terms;
  const { id } = await params;

  const sala = ehId(id)
    ? await carregarSala(id, sessao.userId, papel, papel === "partner" ? t.professional : t.partner)
    : null;
  if (sala === null) {
    return (
      <>
        <SairDoIframe />
        <Portao voltar={inicio} icone="alerta" titulo={`Não encontramos essa ${t.session} na sua agenda`} />
      </>
    );
  }

  const agora = new Date();
  const nome = primeiroNome(sala.outro.nome) || sala.outro.nome;
  const aberta = porta({ status: sala.status, inicio: sala.inicio, fim: sala.fim }, agora);
  const quem = {
    nome: sala.outro.nome,
    foto: sala.outro.foto,
    titulo: `${cap(t.session)} com ${sala.outro.nome}`,
    quando: intervalo(sala.inicio, sala.fim, sala.fuso),
  };

  let presente: boolean;
  let saldo: number | null = null;
  if (papel === "partner") {
    presente = (await presenteNaSala({ bookingId: id, partnerId: sessao.userId, agora })).dadoNestaSessao;
  } else {
    const recebido = await presenteRecebido(id, sessao.userId);
    presente = recebido.recebido;
    saldo = recebido.saldo;
  }

  return (
    <>
      <SairDoIframe />
      <Portao
        quem={quem}
        icone={aberta.aberta ? "log-out" : "check"}
        tomDoIcone={aberta.aberta ? "text-stone" : "text-success"}
        titulo={aberta.aberta ? "Você saiu da sala" : `${cap(t.session)} encerrada`}
      >
        <p className="text-[14px] text-stone">
          {aberta.aberta
            ? `Ela fica aberta até as ${hora(aberta.janela.fecha, sala.fuso)}, se quiser voltar.`
            : papel === "professional"
              ? "Obrigado pela conversa. O que ficou dela é seu — ninguém mais vê."
              : `A presença é conferida pela sala 15 minutos depois do fim. Se ela errar sobre quem compareceu, você corrige em ${cap(t.sessions)}.`}
        </p>

        {presente && (
          <div className="mt-2 flex w-full items-center gap-3.5 rounded-[12px] bg-gold-soft p-3.5 text-left">
            <Ficha size="xl" className={papel === "professional" ? "presente-ficha" : ""} />
            <p className="text-[13.5px] text-gold-deep">
              {papel === "professional" ? (
                <>
                  <b className="text-gold-ink">
                    {nome} te deu 1 {t.ficha} de presente.
                  </b>
                  <br />
                  Ela já está na sua carteira{saldo !== null ? `: saldo ${saldo}` : ""}.
                </>
              ) : (
                <b className="text-gold-ink">
                  Você deu 1 {t.ficha} para {nome} nesta {t.session}.
                </b>
              )}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {aberta.aberta ? (
            <>
              <ButtonLink href={`/sala/${id}`}>Voltar para a sala</ButtonLink>
              <ButtonLink href={inicio} variant="ghost">
                Ir para o início
              </ButtonLink>
            </>
          ) : papel === "professional" ? (
            <>
              <ButtonLink href={`/parceiros/${sala.outro.id}`}>Marcar outra com {nome}</ButtonLink>
              <ButtonLink href="/inicio" variant="ghost">
                Voltar ao início
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/parceiro/sessoes">Ver minhas {t.sessions}</ButtonLink>
          )}
        </div>
      </Portao>
    </>
  );
}
