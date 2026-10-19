import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import { investigationDtoSchema, investigationListSchema, boardDtoSchema, fileDtoSchema, type BoardContentDto } from '@traceboard/contracts';
import { createApi } from '../src/app.js';
import { databaseUrl } from '../src/database/config.js';
import { createDatabasePool } from '../src/database/pool.js';
import { migrate } from '../src/database/migrate.js';
import { PostgresFilesRepository, PostgresInvestigationsRepository } from '../src/features/investigations/index.js';

let pool: Pool; let app: INestApplication; let base: string;
const apiForPool = (value: Pool) => createApi({ investigations: new PostgresInvestigationsRepository(value), files: new PostgresFilesRepository(value) });
beforeAll(async () => {
  const url = databaseUrl(true);
  if (!new URL(url).pathname.endsWith('/traceboard_test')) throw new Error('Las pruebas necesitan la base aislada traceboard_test');
  pool = createDatabasePool(url); await migrate(pool); app = await apiForPool(pool); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
afterAll(async () => { await app?.close(); await pool?.end(); });
describe('API HTTP con PostgreSQL real', () => {
  const content = (): BoardContentDto => {
    const now = new Date().toISOString();
    return { entities: [
      { id: 'doc', kind: 'document', title: 'Entrevista', description: 'Se venden productos agotados', createdAt: now, updatedAt: now, assetId: 'file' },
      { id: 'finding', kind: 'finding', title: 'Stock desactualizado', description: '', createdAt: now, updatedAt: now },
      { id: 'req', kind: 'requirement', title: 'Actualizar stock', description: '', createdAt: now, updatedAt: now, requirement: { code: 'RF-001', priority: 'high', status: 'draft', criteria: ['Registrar ventas'] } },
    ], edges: [
      { id: 'e1', sourceId: 'doc', targetId: 'finding', relation: 'evidences', description: 'Fuente', createdAt: now, metadata: {} },
      { id: 'e2', sourceId: 'finding', targetId: 'req', relation: 'originates', description: '', createdAt: now, metadata: {} },
    ], elements: [{ nodeId: 'doc', x: 20, y: 50 }, { nodeId: 'finding', x: 400, y: 70 }, { nodeId: 'req', x: 800, y: 100 }], assets: [{ id: 'file', name: 'entrevista.pdf', mime: 'application/pdf', size: 100 }], viewport: { x: 10, y: 15, zoom: 0.8 } };
  };
  const create = async () => investigationDtoSchema.parse(await (await fetch(base + '/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Tablero ' + randomUUID().slice(0, 8) }) })).json());
  const put = (id: string, expectedRevision: number, content: unknown) => fetch(base + '/api/investigations/' + id + '/board', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedRevision, content }) });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1sAAAAASUVORK5CYII=', 'base64');
  const upload = (id: string, bytes: Buffer, name = 'evidencia.png', mime = 'image/png') => fetch(base + '/api/investigations/' + id + '/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(name), 'X-File-Mime': mime }, body: bytes });
  it('sube, deduplica y recupera los bytes originales tras recrear API/pool', async () => {
    const investigation = await create(); const name = 'evidencia ñ.png';
    const response = await upload(investigation.id, png, name); expect(response.status).toBe(201);
    const file = fileDtoSchema.parse(await response.json()); expect(file.sha256).toBe(createHash('sha256').update(png).digest('hex'));
    const repeated = fileDtoSchema.parse(await (await upload(investigation.id, png, name)).json()); expect(repeated).toEqual(file);
    const board = content(); board.assets = [{ id: 'file', name, mime: file.mime, size: file.size, file: { id: file.id, sha256: file.sha256 } }];
    expect((await put(investigation.id, 0, board)).status).toBe(200);
    await app.close(); await pool.end(); pool = createDatabasePool(databaseUrl(true)); app = await apiForPool(pool); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    const downloaded = await fetch(base + '/api/investigations/' + investigation.id + '/files/' + file.id + '?download=1');
    expect(downloaded.status).toBe(200); expect(downloaded.headers.get('content-type')).toContain('image/png'); expect(downloaded.headers.get('x-content-type-options')).toBe('nosniff');
    expect(downloaded.headers.get('content-disposition')).toContain('attachment'); expect(downloaded.headers.get('content-disposition')).toContain('%C3%B1');
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(png);
    expect(boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json()).content).toEqual(board);
  });
  it('no permite consultar o vincular archivos de otra investigación', async () => {
    const owner = await create(); const other = await create(); const file = fileDtoSchema.parse(await (await upload(owner.id, png)).json());
    expect((await fetch(base + '/api/investigations/' + other.id + '/files/' + file.id)).status).toBe(404);
    const board = content(); board.assets = [{ id: 'file', name: file.name, mime: file.mime, size: file.size, file: { id: file.id, sha256: file.sha256 } }];
    expect((await put(other.id, 0, board)).status).toBe(400);
    expect(boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + other.id + '/board')).json()).revision).toBe(0);
    board.assets[0]!.name = 'nombre-alterado.png'; expect((await put(owner.id, 0, board)).status).toBe(400);
    expect((await upload(randomUUID(), png)).status).toBe(404); expect((await fetch(base + '/api/investigations/' + owner.id + '/files/not-uuid')).status).toBe(400);
  });
  it('rechaza firmas, rutas, MIME y cuerpos de más de 10 MiB', async () => {
    const investigation = await create();
    expect((await upload(investigation.id, Buffer.from('<script>bad</script>'))).status).toBe(400);
    expect((await upload(investigation.id, png, '../archivo.png')).status).toBe(400);
    expect((await upload(investigation.id, png, 'archivo.png', 'application/pdf')).status).toBe(400);
    expect((await fetch(base + '/api/investigations/' + investigation.id + '/files', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'wrong' })).status).toBe(415);
    expect((await upload(investigation.id, Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
  });
  it('conserva un archivo de exactamente 10 MiB y un PDF íntegro', async () => {
    const investigation = await create(); const large = Buffer.alloc(10 * 1024 * 1024); png.copy(large);
    const response = await upload(investigation.id, large); expect(response.status).toBe(201); const file = fileDtoSchema.parse(await response.json());
    const downloaded = await fetch(base + '/api/investigations/' + investigation.id + '/files/' + file.id); expect(Buffer.from(await downloaded.arrayBuffer()).equals(large)).toBe(true);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const pdfFile = fileDtoSchema.parse(await (await upload(investigation.id, pdf, 'entrevista.pdf', 'application/pdf')).json());
    const pdfResponse = await fetch(base + '/api/investigations/' + investigation.id + '/files/' + pdfFile.id);
    expect(pdfResponse.headers.get('content-type')).toContain('application/pdf'); expect(Buffer.from(await pdfResponse.arrayBuffer())).toEqual(pdf);
  });
  it('recupera el grafo, posiciones y viewport tras recrear API y pool', async () => {
    const investigation = await create(); const board = content();
    const initial = boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json());
    expect(initial.revision).toBe(0); expect(initial.content).toBeNull();
    const response = await put(investigation.id, 0, board); expect(response.status).toBe(200);
    const saved = boardDtoSchema.parse(await response.json()); expect(saved.revision).toBe(1); expect(saved.content).toEqual(board);
    await app.close(); await pool.end(); pool = createDatabasePool(databaseUrl(true)); app = await apiForPool(pool); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    const reopened = boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json());
    expect(reopened).toEqual(saved);
    const replacement = { ...board, entities: [], edges: [], elements: [], assets: [] };
    expect((await put(investigation.id, 1, replacement)).status).toBe(200);
    expect(boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json()).content).toEqual(replacement);
  });
  it('acepta solo una de dos escrituras concurrentes y conserva la ganadora', async () => {
    const investigation = await create();
    const first = content(); const second = content(); second.entities[0]!.title = 'Otra pestaña';
    const responses = await Promise.all([put(investigation.id, 0, first), put(investigation.id, 0, second)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner = boardDtoSchema.parse(await responses.find(response => response.status === 200)!.json());
    const reopened = boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json()); expect(reopened).toEqual(winner);
  });
  it('rechaza grafos rotos y binarios sin alterar el contenido confirmado', async () => {
    const investigation = await create(); const board = content(); expect((await put(investigation.id, 0, board)).status).toBe(200);
    const broken = content(); broken.edges[0]!.sourceId = 'missing'; expect((await put(investigation.id, 1, broken)).status).toBe(400);
    const binary = { ...board, assets: [{ ...board.assets[0], url: 'data:application/pdf;base64,AAAA' }] }; expect((await put(investigation.id, 1, binary)).status).toBe(400);
    const reopened = boardDtoSchema.parse(await (await fetch(base + '/api/investigations/' + investigation.id + '/board')).json()); expect(reopened.revision).toBe(1); expect(reopened.content).toEqual(board);
    expect((await put(randomUUID(), 0, board)).status).toBe(404); expect((await fetch(base + '/api/investigations/missing/board')).status).toBe(400);
  });
  it('rechaza cuerpos superiores a 8 MiB y medios ajenos a JSON', async () => {
    const investigation = await create(); const url = base + '/api/investigations/' + investigation.id + '/board';
    expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(8 * 1024 * 1024) }) })).status).toBe(413);
    expect(boardDtoSchema.parse(await (await fetch(url)).json()).revision).toBe(0);
  });
  it('crea, lista y reabre una investigación incluso tras recrear la API', async () => {
    const body = { name: 'Integración ' + randomUUID().slice(0, 8), description: 'SQL real y recuperación' };
    const created = await fetch(base + '/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(created.status).toBe(201); const dto = investigationDtoSchema.parse(await created.json());
    expect(dto.name).toBe(body.name); expect(dto.description).toBe(body.description);
    const listed = investigationListSchema.parse(await (await fetch(base + '/api/investigations')).json());
    expect(listed.some(item => item.id === dto.id)).toBe(true);
    await app.close(); await pool.end(); pool = createDatabasePool(databaseUrl(true)); app = await apiForPool(pool); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
    const reopened = await fetch(base + '/api/investigations/' + dto.id); expect(reopened.status).toBe(200);
    expect(investigationDtoSchema.parse(await reopened.json())).toEqual(dto);
  });
  it('valida entradas y distingue 400 de 404', async () => {
    const invalid = await fetch(base + '/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '   ' }) }); expect(invalid.status).toBe(400);
    expect((await fetch(base + '/api/investigations/no-es-uuid')).status).toBe(400);
    expect((await fetch(base + '/api/investigations/' + randomUUID())).status).toBe(404);
  });
  it('solo admite JSON para crear, sin aceptar formularios de otros sitios', async () => {
    const response = await fetch(base + '/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'name=No+crear+desde+formulario' });
    expect(response.status).toBe(415);
  });
  it('trata contenido SQL como datos, sin alterar el esquema', async () => {
    const name = "Investigación '; DROP TABLE investigations; --";
    const response = await fetch(base + '/api/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    expect(response.status).toBe(201); expect(investigationDtoSchema.parse(await response.json()).name).toBe(name);
    expect((await fetch(base + '/api/investigations')).status).toBe(200);
  });
  it('migraciones idempotentes y restricciones de integridad reales', async () => {
    await migrate(pool);
    await expect(pool.query('INSERT INTO investigations (public_id,name,description,created_at,updated_at) VALUES ($1,$2,$3,now(),now())', [randomUUID(), '', ''])).rejects.toThrow();
    const applied = await pool.query("SELECT name FROM traceboard_migrations WHERE name='001-investigations.sql'"); expect(applied.rows).toHaveLength(1);
  });
  it('devuelve 503 si el adaptador no puede conectar, sin filtrar credenciales', async () => {
    const credential = randomUUID();
    const unavailableUrl = new URL('postgresql://unused@127.0.0.1:1/traceboard_test');
    unavailableUrl.password = credential;
    const unavailable = createDatabasePool(unavailableUrl.toString());
    const api = await apiForPool(unavailable); await api.listen(0, '127.0.0.1');
    try { const response = await fetch((await api.getUrl()) + '/api/investigations'); expect(response.status).toBe(503); const raw = await response.text(); expect(raw).not.toContain(credential); expect(raw).not.toContain('postgresql'); }
    finally { await api.close(); await unavailable.end(); }
  });
});
