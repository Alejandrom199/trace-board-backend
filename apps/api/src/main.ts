import { createApi } from './app.js';
import { databaseUrl } from './database/config.js';
import { createDatabasePool } from './database/pool.js';
import { InMemoryFilesRepository, InMemoryInvestigationsRepository, InMemoryTraceBoardStore, PostgresFilesRepository, PostgresInvestigationsRepository } from './features/investigations/index.js';
async function main() {
  const storage = process.env.TRACEBOARD_STORAGE ?? (process.env.NODE_ENV === 'production' ? 'memory' : 'postgres');
  if (storage !== 'memory' && storage !== 'postgres') throw new Error('TRACEBOARD_STORAGE debe ser memory o postgres');
  const accessToken = process.env.TRACEBOARD_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (!accessToken || accessToken.length < 32)) throw new Error('TRACEBOARD_API_TOKEN es obligatorio en producción y debe tener al menos 32 caracteres');
  const pool = storage === 'postgres' ? createDatabasePool(databaseUrl()) : undefined;
  const memory = storage === 'memory' ? new InMemoryTraceBoardStore() : undefined;
  const investigations = pool ? new PostgresInvestigationsRepository(pool) : new InMemoryInvestigationsRepository(memory!);
  const files = pool ? new PostgresFilesRepository(pool) : new InMemoryFilesRepository(memory!);
  const allowedOrigins = process.env.TRACEBOARD_ALLOWED_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean);
  const ai = { token: process.env.HF_API_TOKEN, model: process.env.HF_MODEL ?? 'Qwen/Qwen2.5-7B-Instruct' };
  const app = await createApi({ investigations, files, accessToken, allowedOrigins, ai });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(Number(process.env.PORT ?? 4000), host);
  console.log(`TraceBoard API lista en ${host}:${process.env.PORT ?? 4000} con almacenamiento ${storage}.`);
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); await pool?.end(); };
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown());
}
void main().catch(() => { console.error('No se pudo iniciar la API. Revisa la configuración del entorno.'); process.exitCode = 1; });
