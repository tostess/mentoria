import { DateTime, IANAZone } from "luxon";
import { diasEntre, faixasDoDia } from "./dias";
import type {
  Limites,
  MotivoDaRecusa,
  Ocupacao,
  Parceiro,
  Slot,
} from "./tipos";

/**
 * O motor. Regra semanal do Parceiro mais o que já está marcado, e sai a lista
 * de horários que o Profissional pode escolher.
 *
 * Invariante 14: todo horário exibido em qualquer tela vem daqui. Nenhuma tela
 * soma 30 minutos por conta própria.
 *
 * Luxon entra porque converter "9h no fuso do Parceiro" em instante é o ponto
 * inteiro da invariante 2, e essa conta é errada de três jeitos diferentes se
 * feita à mão. Continua sendo módulo puro: Luxon não fala com banco nem rede.
 */

export type Entrada = {
  /** O instante de referência. Parâmetro, não `new Date()` — motor não olha relógio. */
  agora: Date;
  parceiro: Parceiro;
  /** Sessões já marcadas do Parceiro, em qualquer status que ocupe agenda. */
  ocupacoes: readonly Ocupacao[];
  limites: Limites;
};

export type Avaliacao = { slot: Slot; recusa: MotivoDaRecusa | null };

const UM_MINUTO = 60_000;

/**
 * Minutos locais viram instante, ou null se aquela hora não existiu.
 *
 * Na virada do horário de verão para frente, o relógio local salta e das 0h às
 * 1h simplesmente não houve. Luxon, pedido esse horário, devolve o instante
 * seguinte em vez de recusar — o que produziria um slot às 0h30 que apareceria
 * na tela como 1h30. Então o resultado é reconferido: se o relógio local não
 * bate com o que se pediu, aquela hora não existe e o horário não entra.
 *
 * O Brasil não tem horário de verão desde 2019, mas o campo é IANA e o motor
 * fica travado — errar isso agora custaria uma sessão perdida quando o primeiro
 * Parceiro de fora entrar.
 */
export function instanteLocal(iso: string, minutos: number, fuso: string): Date | null {
  if (!IANAZone.isValidZone(fuso)) throw new Error(`fuso inválido: ${fuso}`);
  if (!Number.isInteger(minutos) || minutos < 0) {
    throw new Error(`minutos inválidos: ${minutos}`);
  }

  const [ano, mes, dia] = iso.split("-").map(Number);
  const diasAdiante = Math.floor(minutos / 1440);
  const doDia = minutos % 1440;
  const hora = Math.floor(doDia / 60);
  const minuto = doDia % 60;

  /**
   * Construído direto na hora alvo, e não somando minutos à meia-noite.
   *
   * Somar seria mais simples e estaria errado: há fusos cuja virada acontece à
   * meia-noite, e nesses a própria base já nasceria deslocada — a conferência
   * abaixo passaria a recusar horários que existem perfeitamente.
   */
  const alvo = DateTime.fromObject(
    { year: ano, month: mes, day: dia, hour: hora, minute: minuto },
    { zone: fuso },
  );
  if (!alvo.isValid) return null;

  // A conferência: pedimos 1h30 e o relógio local diz 1h30? Se não, aquela hora
  // não existiu — Luxon empurra para a frente em vez de recusar.
  if (alvo.hour !== hora || alvo.minute !== minuto) return null;

  return (diasAdiante > 0 ? alvo.plus({ days: diasAdiante }) : alvo).toJSDate();
}

/**
 * Chave da semana local do Parceiro, no formato da data do domingo.
 *
 * Domingo e não segunda porque `partner_rules.weekday` usa 0 para domingo, a
 * mesma convenção do `dow` do Postgres e do calendário brasileiro. Contar a
 * carga semanal numa fronteira e escrever a regra em outra faria "4 sessões por
 * semana" significar coisas diferentes em cada lugar.
 */
export function chaveDaSemana(instante: Date, fuso: string): string {
  const local = DateTime.fromJSDate(instante, { zone: fuso });
  // Luxon: 1 = segunda … 7 = domingo. Domingo recua zero dia.
  const recuo = local.weekday === 7 ? 0 : local.weekday;
  return local.minus({ days: recuo }).toISODate()!;
}

/** Dois intervalos de instantes respeitam o descanso entre eles? */
function respeitaDescanso(slot: Slot, ocupacao: Ocupacao, bufferMin: number): boolean {
  const folga = bufferMin * UM_MINUTO;
  return (
    slot.fim.getTime() + folga <= ocupacao.inicio.getTime() ||
    ocupacao.fim.getTime() + folga <= slot.inicio.getTime()
  );
}

function seSobrepoem(slot: Slot, ocupacao: Ocupacao): boolean {
  return slot.inicio < ocupacao.fim && ocupacao.inicio < slot.fim;
}

/**
 * Todos os horários candidatos da janela, cada um com o veredito.
 *
 * Existe além de `slotsDisponiveis` porque "por que não tem horário?" é uma
 * pergunta que o Parceiro e o suporte vão fazer, e responder "porque o motor
 * não devolveu nada" não serve. Também é o que deixa os testes afirmarem o
 * motivo, e não só a ausência.
 */
export function avaliarSlots(entrada: Entrada): Avaliacao[] {
  const { agora, parceiro, ocupacoes, limites } = entrada;
  const { fuso, bufferMin, maxPorSemana } = parceiro;

  const passo = limites.passoMin > 0 ? limites.passoMin : limites.duracaoMin;
  const naoAntesDe = agora.getTime() + limites.avisoMinimoHoras * 3_600_000;
  const naoDepoisDe = agora.getTime() + limites.horizonteDias * 86_400_000;

  if (!IANAZone.isValidZone(fuso)) throw new Error(`fuso inválido: ${fuso}`);

  const primeiroDia = DateTime.fromJSDate(agora, { zone: fuso }).toISODate();
  const ultimoDia = DateTime.fromJSDate(new Date(naoDepoisDe), { zone: fuso }).toISODate();
  if (primeiroDia === null || ultimoDia === null) throw new Error(`fuso inválido: ${fuso}`);

  /** Quantas sessões o Parceiro já tem em cada semana local. */
  const cargaDaSemana = new Map<string, number>();
  for (const ocupacao of ocupacoes) {
    const chave = chaveDaSemana(ocupacao.inicio, fuso);
    cargaDaSemana.set(chave, (cargaDaSemana.get(chave) ?? 0) + 1);
  }

  const avaliacoes: Avaliacao[] = [];

  for (const dia of diasEntre(primeiroDia, ultimoDia)) {
    for (const faixa of faixasDoDia(parceiro, dia)) {
      for (let inicioMin = faixa.inicio; inicioMin + limites.duracaoMin <= faixa.fim; inicioMin += passo) {
        const inicio = instanteLocal(dia, inicioMin, fuso);
        if (inicio === null) {
          // Hora que não existiu no relógio local. Sem slot e sem fim a calcular.
          continue;
        }
        const slot: Slot = {
          inicio,
          fim: new Date(inicio.getTime() + limites.duracaoMin * UM_MINUTO),
        };
        avaliacoes.push({ slot, recusa: julgar(slot) });
      }
    }
  }

  function julgar(slot: Slot): MotivoDaRecusa | null {
    if (slot.inicio.getTime() < naoAntesDe) return "fora-do-aviso-minimo";
    if (slot.inicio.getTime() > naoDepoisDe) return "fora-do-horizonte";

    for (const ocupacao of ocupacoes) {
      if (seSobrepoem(slot, ocupacao)) return "ocupado";
      if (!respeitaDescanso(slot, ocupacao, bufferMin)) return "descanso";
    }

    if ((cargaDaSemana.get(chaveDaSemana(slot.inicio, fuso)) ?? 0) >= maxPorSemana) {
      return "teto-semanal";
    }

    return null;
  }

  return avaliacoes.sort((a, b) => a.slot.inicio.getTime() - b.slot.inicio.getTime());
}

/** O que o Profissional pode escolher. É isto que vai para a tela. */
export function slotsDisponiveis(entrada: Entrada): Slot[] {
  return avaliarSlots(entrada)
    .filter((avaliacao) => avaliacao.recusa === null)
    .map((avaliacao) => avaliacao.slot);
}

/**
 * O primeiro horário livre, ou null.
 *
 * Serve para "próxima vaga" na busca de Parceiros, onde a tela mostra um por
 * Parceiro e não a grade inteira.
 */
export function proximoSlot(entrada: Entrada): Slot | null {
  return slotsDisponiveis(entrada)[0] ?? null;
}
