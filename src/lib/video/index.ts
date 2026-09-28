import "server-only";

import { hasDailyApiKey, requireDailyApiKey } from "@/lib/env.server";
import { clienteDaily, type ClienteDaily } from "./daily";

/**
 * A porta do Daily com a chave do ambiente. O resto de `lib/video` é puro e
 * recebe o cliente pronto — é aqui, e só aqui, que o segredo entra.
 */

export function videoConfigurado(): boolean {
  return hasDailyApiKey;
}

let cliente: ClienteDaily | null = null;

export function daily(): ClienteDaily {
  cliente ??= clienteDaily({ apiKey: requireDailyApiKey() });
  return cliente;
}
