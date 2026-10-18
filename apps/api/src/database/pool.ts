import { Pool } from 'pg';
export function createDatabasePool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, statement_timeout: 5000 });
  pool.on('error', () => { /* Individual operations expose a sanitized unavailable response. */ });
  return pool;
}
