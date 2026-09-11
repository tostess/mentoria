import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Os testes de invariante falam com o Postgres de verdade e precisam de
// `DIRECT_URL`. Sem ele a suíte de banco se pula sozinha.
loadEnv({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Uma transação de cada vez: os testes de banco compartilham a conexão.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
