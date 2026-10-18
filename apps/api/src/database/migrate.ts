import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import { databaseUrl } from './config.js';
import { createDatabasePool } from './pool.js';
export async function migrate(pool: Pool, directory = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../migrations')): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(70632112)');
    await client.query('CREATE TABLE IF NOT EXISTS traceboard_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of readdirSync(directory).filter(name => /^\d+-[a-z-]+\.sql$/.test(name)).sort()) {
      const applied = await client.query('SELECT name FROM traceboard_migrations WHERE name=$1', [file]);
      if (!applied.rows.length) { await client.query(readFileSync(resolve(directory, file), 'utf8')); await client.query('INSERT INTO traceboard_migrations (name) VALUES ($1)', [file]); }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function main() { const pool = createDatabasePool(databaseUrl()); try { await migrate(pool); console.log('Migraciones de TraceBoard aplicadas.'); } finally { await pool.end(); } }
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main().catch(() => { console.error('No se pudieron aplicar las migraciones. Comprueba npm run db:setup.'); process.exitCode = 1; });
