/**
 * Chaves de idempotência do livro-caixa.
 *
 * Invariante 16: todo lançamento carrega uma `idempotency_key` única, e é a
 * constraint do banco que impede o lançamento repetido — não uma checagem
 * antes do insert, que perderia a corrida com um segundo clique.
 *
 * O trabalho agendado tem chave derivada do período (`alloc_{user}_{YYYYMM}`):
 * rodar duas vezes no mesmo mês colide, que é exatamente o que se quer. A
 * ação manual do admin não tem período — duas compras de 120 fichas no mesmo
 * dia são dois fatos legítimos — então a unicidade vem de um token sorteado
 * quando o formulário é montado. Reenviar o mesmo formulário colide; abrir a
 * tela de novo e registrar outra compra não.
 *
 * Módulo puro: sem banco, sem `crypto` de plataforma. Quem sorteia o token é
 * quem renderiza o formulário.
 */

/** Sufixo de token aceito: o bastante para não colidir, pouco para caber no log. */
const TOKEN = /^[0-9a-z-]{8,64}$/;

export class ChaveInvalida extends Error {
  constructor(motivo: string) {
    super(`chave de idempotência inválida: ${motivo}`);
    this.name = "ChaveInvalida";
  }
}

function exigeToken(token: string): string {
  const valor = token.trim().toLowerCase();
  if (!TOKEN.test(valor)) {
    throw new ChaveInvalida(`token fora do formato (${token.length} caracteres)`);
  }
  return valor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigeId(valor: string): string {
  const id = valor.trim().toLowerCase();
  if (!UUID.test(id)) throw new ChaveInvalida(`identificador fora do formato: ${valor}`);
  return id;
}

/** `YYYYMM` a partir de uma data, no fuso que quem chama já resolveu. */
export function periodo(ano: number, mes: number): string {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 9999) {
    throw new ChaveInvalida(`ano fora da faixa: ${ano}`);
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new ChaveInvalida(`mês fora da faixa: ${mes}`);
  }
  return `${ano}${String(mes).padStart(2, "0")}`;
}

/**
 * Compra de bloco de fichas pelo admin. Fato único e datado, mas sem período
 * natural — a unicidade é o token do formulário.
 */
export function chaveCompra(orgId: string, token: string): string {
  return `purchase_${orgId}_${exigeToken(token)}`;
}

/**
 * Alocação manual — RH ou admin escolhendo a dedo. Distinta de propósito da
 * chave do cron: se as duas fossem `alloc_{user}_{YYYYMM}`, a primeira
 * alocação manual do mês silenciaria a automática, e o colaborador ficaria
 * sem as fichas do mês sem erro nenhum aparecer.
 */
export function chaveAlocacaoManual(userId: string, token: string): string {
  return `allocmanual_${userId}_${exigeToken(token)}`;
}

/** Alocação mensal automática. Formato fixado pela invariante 16. */
export function chaveAlocacaoMensal(userId: string, ano: number, mes: number): string {
  return `alloc_${userId}_${periodo(ano, mes)}`;
}

/**
 * Gasto de ficha numa sessão.
 *
 * A chave é o próprio `booking_id`, e não um token de formulário, porque a
 * reserva **tem** um identificador natural: uma sessão, um gasto. O id é
 * sorteado pela aplicação antes da transação — como já se faz com a identidade
 * em `pessoas/criar.ts` — justamente para a chave existir antes da linha e o
 * `wallet_ledger.booking_id` poder apontar para ela no mesmo insert.
 *
 * Não passa por `exigeToken`: uuid do banco não é token de formulário, e exigir
 * o formato do outro só produziria uma validação que nunca falha.
 */
export function chaveGasto(bookingId: string): string {
  return `spend_${exigeId(bookingId)}`;
}

/**
 * Estorno da ficha de uma sessão.
 *
 * **Uma chave por sessão, seja qual for o caminho** — recusa do Parceiro,
 * expiração pelo cron e, depois, cancelamento. Se cada caminho tivesse a sua
 * (`decline_…`, `expire_…`), o Parceiro recusando no minuto em que o cron expira
 * o pedido devolveria a ficha duas vezes. Com uma só, quem chega depois colide
 * na `unique` do livro-caixa.
 */
export function chaveEstorno(bookingId: string): string {
  return `refund_${exigeId(bookingId)}`;
}

/**
 * Presente do Parceiro, dado dentro da sala (invariante 20).
 *
 * Uma chave por sessão: é a `unique` do livro-caixa que garante "1 por sessão".
 * O segundo clique, a segunda aba ou o botão apertado nos dois celulares do
 * Parceiro colidem — conferir antes do insert perderia essa corrida.
 */
export function chavePresente(bookingId: string): string {
  return `gift_${exigeId(bookingId)}`;
}

/**
 * Compensação ao Profissional quando o Parceiro não entrou na sala
 * (`partner_no_show_bonus`). Uma por sessão, pelo mesmo motivo do estorno: o
 * fechamento pode rodar duas vezes, a compensação não.
 */
export function chaveCompensacao(bookingId: string): string {
  return `noshow_${exigeId(bookingId)}`;
}

/** Ajuste de correção (invariante 3: corrige-se lançando, nunca editando). */
export function chaveAjuste(alvoId: string, token: string): string {
  return `adjust_${alvoId}_${exigeToken(token)}`;
}
