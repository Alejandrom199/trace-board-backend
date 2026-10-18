import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const pg = createRequire(join(root, 'apps/api/package.json'))('pg');
const directory = resolve(root, '.local');
const data = resolve(directory, 'postgres');
if (!data.startsWith(root + '\\') && !data.startsWith(root + '/')) throw new Error('Directorio de datos fuera del proyecto');
const configuration = join(directory, 'database.json');
const bin = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const suffix = process.platform === 'win32' ? '.exe' : '';
function run(name, args, accept = [0]) {
  const result = spawnSync(join(bin, name + suffix), args, { stdio: 'inherit', windowsHide: true });
  if (!accept.includes(result.status)) throw new Error(`No se pudo ejecutar ${name}; comprueba PG_BIN y que el puerto 55432 esté libre`);
  return result.status;
}
async function setup() {
  mkdirSync(directory, { recursive: true });
  let config;
  if (existsSync(configuration)) config = JSON.parse(readFileSync(configuration, 'utf8'));
  else {
    if (existsSync(join(data, 'PG_VERSION'))) throw new Error('Hay un cluster sin configuración de TraceBoard; no se modificará');
    const adminPassword = randomBytes(24).toString('hex'); const appPassword = randomBytes(24).toString('hex');
    config = { adminPassword, appPassword, connectionString: `postgresql://traceboard_app:${appPassword}@127.0.0.1:55432/traceboard`, testConnectionString: `postgresql://traceboard_app:${appPassword}@127.0.0.1:55432/traceboard_test` };
    writeFileSync(configuration, JSON.stringify(config), { mode: 0o600 });
  }
  if (!/^[a-f0-9]{48}$/.test(config.adminPassword) || !/^[a-f0-9]{48}$/.test(config.appPassword)) throw new Error('Configuración local inválida');
  if (!existsSync(join(data, 'PG_VERSION'))) {
    const passwordFile = join(directory, 'postgres-password.txt');
    writeFileSync(passwordFile, config.adminPassword, { mode: 0o600 });
    run('initdb', ['-D', data, '-U', 'traceboard_admin', '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile=' + passwordFile, '--encoding=UTF8', '--locale=C']);
  }
  const status = run('pg_ctl', ['status', '-D', data], [0, 3]);
  if (status !== 0) run('pg_ctl', ['start', '-D', data, '-l', join(directory, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w']);
  const client = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'traceboard_admin', password: config.adminPassword, database: 'postgres', connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    if (!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='traceboard_app'")).rows.length) {
      const generated = await client.query("SELECT format('CREATE ROLE traceboard_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', $1::text) AS command", [config.appPassword]);
      await client.query(generated.rows[0].command);
    }
    for (const [name, sql] of [['traceboard', 'CREATE DATABASE traceboard OWNER traceboard_app'], ['traceboard_test', 'CREATE DATABASE traceboard_test OWNER traceboard_app']]) {
      if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rows.length) await client.query(sql);
    }
    console.log('PostgreSQL local listo en 127.0.0.1:55432. Bases traceboard y traceboard_test, sin tocar instalaciones existentes.');
  } finally { await client.end(); }
}
if (process.argv[2] === 'stop') {
  if (!existsSync(configuration) || !existsSync(join(data, 'PG_VERSION'))) throw new Error('No hay un cluster de TraceBoard que detener');
  run('pg_ctl', ['stop', '-D', data, '-m', 'fast', '-w']);
} else if (process.argv[2] === 'setup') await setup();
else throw new Error('Usa npm run db:setup o npm run db:stop');
