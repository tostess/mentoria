import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ContagemParaAbrir } from "@/components/sala/ContagemParaAbrir";
import { Portao } from "@/components/sala/Portao";
import { SalaAoVivo, type PresenteNaSala } from "@/components/sala/SalaAoVivo";
import { requireRole } from "@/lib/auth/session";
import { presenteNaSala } from "@/lib/bookings";
import { loadAppConfig } from "@/lib/config/load";
import { chaveDoDia, diaEHora, hora, intervalo, nomeDoMes } from "@/lib/formato";
import { ehId } from "@/lib/forms";
import { FUSO_DA_PLATAFORMA } from "@/lib/ledger/mensal";
import { cap } from "@/lib/terms";
import { carregarSala, presenteRecebido } from "@/lib/video/dados";
import { primeiroNome, porta } from "@/lib/video/sala";

export const metadata = { title: "Sala" };

/** Abaixo disto a tela de espera mostra a contagem; acima, só a hora. */
const CONTAGEM_A_PARTIR_DE = 60 * 60_000;

/** Status que já passaram pelo fechamento: a sala acabou, resta a tela de fim. */
const ENCERRADAS = new Set(["done", "no_show_professional", "no_show_partner"]);

/**
 * A sala da sessão, dos dois lados.
 *
 * Tudo o que é instante é convertido aqui, no fuso de quem olha; o componente
 * de cliente recebe texto e o ISO para contar. O token do vídeo **não** sai
 * daqui: é pedido pelo cliente ao montar, porque o Prebuilt o consome na
 * primeira leitura e um token no HTML voltaria inútil a cada recarga.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("professional", "partner");
  const papel = sessao.role === "partner" ? "partner" : "professional";
  const voltar = papel === "partner" ? "/parceiro/sessoes" : "/agenda";
  const config = await loadAppConfig();
  const t = config.terms;
  const { id } = await params;

  const sala = ehId(id)
    ? await carregarSala(id, sessao.userId, papel, papel === "partner" ? t.professional : t.partner)
    : null;
  if (sala === null) {
    return (
      <Portao voltar={voltar} icone="alerta" titulo={`Não encontramos essa ${t.session} na sua agenda`}>
        <p className="text-[14px] text-[#8E7C86]">Confira o endereço, ou volte para a agenda e entre por lá.</p>
      </Portao>
    );
  }

  const agora = new Date();
  const { fuso, outro } = sala;
  const quem = {
    nome: outro.nome,
    foto: outro.foto,
    titulo: `${cap(t.session)} com ${outro.nome}`,
    quando: intervalo(sala.inicio, sala.fim, fuso),
  };

  if (ENCERRADAS.has(sala.status)) redirect(`/sala/${id}/fim`);

  const agoraNaSala = porta({ status: sala.status, inicio: sala.inicio, fim: sala.fim }, agora);
  if (!agoraNaSala.aberta) {
    if (agoraNaSala.motivo === "encerrada") redirect(`/sala/${id}/fim`);

    if (agoraNaSala.motivo === "nao-confirmada") {
      return (
        <Portao voltar={voltar} quem={quem} icone="info" titulo={`Esta ${t.session} não está confirmada`}>
          <p className="text-[14px] text-[#8E7C86]">
            A sala só abre para {t.sessions} confirmadas. A agenda mostra em que pé ela está.
          </p>
          <ButtonLink href={voltar} variant="ghost" className="mt-2">
            Ver a agenda
          </ButtonLink>
        </Portao>
      );
    }

    const abre = agoraNaSala.janela.abre;
    const hoje = chaveDoDia(abre, fuso) === chaveDoDia(agora, fuso);
    return (
      <Portao
        voltar={voltar}
        quem={quem}
        icone="clock"
        titulo={hoje ? `A sala abre às ${hora(abre, fuso)}` : `A sala abre ${diaEHora(abre, fuso)}`}
      >
        <p className="text-[14px] text-[#8E7C86]">
          Dez minutos antes do horário, para você testar câmera e microfone sem pressa.
          {abre.getTime() - agora.getTime() < CONTAGEM_A_PARTIR_DE &&
            " Esta página entra sozinha quando abrir — pode deixá-la aberta."}
        </p>
        {abre.getTime() - agora.getTime() < CONTAGEM_A_PARTIR_DE && (
          <div className="mt-3">
            <ContagemParaAbrir abreIso={abre.toISOString()} agoraIso={agora.toISOString()} />
          </div>
        )}
      </Portao>
    );
  }

  let presente: PresenteNaSala;
  if (papel === "partner") {
    const estado = await presenteNaSala({ bookingId: id, partnerId: sessao.userId, agora });
    presente = {
      papel,
      cota: estado.cota,
      usados: estado.usados,
      dado: estado.dadoNestaSessao,
      mes: nomeDoMes(agora, FUSO_DA_PLATAFORMA),
    };
  } else {
    const estado = await presenteRecebido(id, sessao.userId);
    presente = { papel, ...estado, tetoVisual: config.fichaPolicy.maxBalance };
  }

  return (
    <SalaAoVivo
      bookingId={id}
      inicioIso={sala.inicio.toISOString()}
      fimIso={sala.fim.toISOString()}
      fechaIso={agoraNaSala.janela.fecha.toISOString()}
      agoraIso={agora.toISOString()}
      intervalo={intervalo(sala.inicio, sala.fim, fuso)}
      comecaAs={hora(sala.inicio, fuso)}
      terminaAs={hora(sala.fim, fuso)}
      outro={{
        nome: outro.nome,
        primeiroNome: primeiroNome(outro.nome) || outro.nome,
        foto: outro.foto,
        linha: outro.linha,
      }}
      presente={presente}
    />
  );
}
