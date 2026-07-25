/**
 * `next dev` com os emuladores ligados.
 *
 * Existe porque `VAR=valor comando` nao funciona no shell do Windows, e o
 * roteiro de setup fecha a porta para dependencias novas (cross-env, dotenv-cli).
 * Dez linhas de Node resolvem e rodam igual nos tres sistemas.
 */
import { spawn } from 'node:child_process';

const child = spawn('next', ['dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_USE_EMULATORS: 'true' },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
