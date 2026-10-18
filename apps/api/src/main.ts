import { createApi } from './app.js';
import { databaseUrl } from './database/config.js';
import { createDatabasePool } from './database/pool.js';
async function main() {
  const pool = createDatabasePool(databaseUrl());
  const app = await createApi(pool);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  await app.listen(Number(process.env.PORT ?? 4000), '127.0.0.1');
  console.log('TraceBoard API lista en http://127.0.0.1:' + (process.env.PORT ?? 4000));
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await app.close(); await pool.end(); };
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown());
}
void main().catch(() => { console.error('No se pudo iniciar la API. Comprueba la base de datos con npm run db:setup.'); process.exitCode = 1; });
