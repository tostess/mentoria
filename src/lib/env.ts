/**
 * Leitura de variaveis de ambiente. Nenhuma chave hardcoded no repositorio.
 *
 * A leitura e sempre preguicosa — chamada dentro de funcao, nunca no topo do
 * modulo. Se fosse avaliada no import, um `next build` sem `.env.local`
 * quebraria na prerenderizacao. Assim o erro aparece onde importa (na hora de
 * falar com o Firebase) e diz o nome da variavel que falta.
 *
 * Duas portas de entrada de proposito:
 *
 *   `required(nome, valor)`  — para variaveis que vao para o browser. O Next so
 *     substitui `process.env.NEXT_PUBLIC_X` quando o acesso e ESTATICO; com
 *     indice dinamico (`process.env[nome]`) o valor chega `undefined` no
 *     bundle. Por isso quem chama passa o valor ja lido estaticamente.
 *
 *   `requiredEnv(nome)`      — atalho para codigo que so roda no servidor
 *     (Admin SDK, rotas, scripts), onde `process.env` existe de verdade em
 *     tempo de execucao e o indice dinamico e seguro.
 */

function missing(name: string): never {
  throw new Error(
    `Variavel de ambiente ausente: ${name}. ` +
      'Copie .env.local.example para .env.local e preencha.',
  );
}

/** Valida um valor ja lido. Use quando o acesso precisa ser estatico. */
export function required(name: string, value: string | undefined): string {
  return value || missing(name);
}

/** Le e valida. Somente em codigo de servidor. */
export function requiredEnv(name: string): string {
  return process.env[name] || missing(name);
}

/** Le uma variavel opcional, com valor padrao. */
export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}
