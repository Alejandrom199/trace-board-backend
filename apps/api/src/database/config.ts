import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
export function databaseUrl(test = false): string {
  const supplied = process.env[test ? 'TEST_DATABASE_URL' : 'DATABASE_URL'];
  if (supplied) return z.url().parse(supplied);
  const raw: unknown = JSON.parse(readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../.local/database.json'), 'utf8'));
  const config = z.object({ connectionString: z.string(), testConnectionString: z.string() }).parse(raw);
  return test ? config.testConnectionString : config.connectionString;
}
