import { describe, expect, it } from 'vitest';
import { InMemoryFilesRepository, InMemoryInvestigationsRepository, InMemoryTraceBoardStore } from './memory-repositories.js';
import type { Investigation } from '../domain/investigation.js';
import type { BoardContent } from '../domain/board.js';
import type { StoredFile } from '../domain/file.js';

const investigation = (id = '00000000-0000-4000-8000-000000000001'): Investigation => ({
  id, name: 'Inventario', description: '', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
});
const emptyBoard = (): BoardContent => ({ entities: [], edges: [], elements: [], assets: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('adaptadores temporales en memoria', () => {
  it('crea, lista y actualiza un tablero con control de revisión', async () => {
    const store = new InMemoryTraceBoardStore();
    const repository = new InMemoryInvestigationsRepository(store);
    const created = await repository.create(investigation());
    created.name = 'mutación externa';
    expect((await repository.list())[0]?.name).toBe('Inventario');
    expect((await repository.board(investigation().id))?.revision).toBe(0);
    expect((await repository.saveBoard(investigation().id, 0, emptyBoard(), '2026-10-18T00:01:00.000Z')).revision).toBe(1);
    await expect(repository.saveBoard(investigation().id, 0, emptyBoard(), '2026-10-18T00:02:00.000Z')).rejects.toThrow('Otra sesión');
  });
  it('deduplica archivos, conserva bytes y exige pertenencia al guardar', async () => {
    const store = new InMemoryTraceBoardStore();
    const investigations = new InMemoryInvestigationsRepository(store);
    const files = new InMemoryFilesRepository(store);
    await investigations.create(investigation());
    const stored: StoredFile = { info: { id: '00000000-0000-4000-8000-000000000002', investigationId: investigation().id, name: 'evidencia.pdf', mime: 'application/pdf', size: 5, sha256: 'hash', createdAt: '2026-10-18T00:00:00.000Z' }, bytes: new Uint8Array([37, 80, 68, 70, 45]) };
    expect(await files.store(stored)).toEqual(stored.info);
    const duplicate = structuredClone(stored); duplicate.info.id = '00000000-0000-4000-8000-000000000003';
    expect((await files.store(duplicate)).id).toBe(stored.info.id);
    const recovered = await files.find(stored.info.investigationId, stored.info.id);
    expect(recovered?.bytes).toEqual(stored.bytes);
    recovered!.bytes[0] = 0;
    expect((await files.find(stored.info.investigationId, stored.info.id))?.bytes[0]).toBe(37);
    const board = emptyBoard(); board.assets.push({ id: 'asset', name: stored.info.name, mime: stored.info.mime, size: stored.info.size, file: { id: stored.info.id, sha256: stored.info.sha256 } });
    expect((await investigations.saveBoard(investigation().id, 0, board, '2026-10-18T00:01:00.000Z')).content).toEqual(board);
  });
  it('no acepta archivos para investigaciones inexistentes', async () => {
    const files = new InMemoryFilesRepository(new InMemoryTraceBoardStore());
    const stored: StoredFile = { info: { id: '00000000-0000-4000-8000-000000000002', investigationId: investigation().id, name: 'evidencia.pdf', mime: 'application/pdf', size: 5, sha256: 'hash', createdAt: '2026-10-18T00:00:00.000Z' }, bytes: new Uint8Array([37, 80, 68, 70, 45]) };
    await expect(files.store(stored)).rejects.toThrow('no existe');
  });
});
