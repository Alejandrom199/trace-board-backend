import { describe, it, expect } from 'vitest';
import { Investigations, type InvestigationsRepository } from './investigations.js';
import type { Investigation } from '../domain/investigation.js';
function service() {
  const entries: Investigation[] = [];
  const repository: InvestigationsRepository = { create: async item => { entries.push(item); return item; }, list: async () => entries, find: async id => entries.find(item => item.id === id) ?? null, board: async () => null, saveBoard: async () => { throw new Error('Not used'); } };
  return new Investigations(repository, { id: () => '977d38bd-1bde-4823-bd3c-3fb5d32901e5', now: () => '2026-10-13T18:00:00.000Z' });
}
describe('Casos de uso de investigaciones', () => {
  it('crea y recupera una investigación con sus metadatos', async () => {
    const investigations = service(); const item = await investigations.create('  Compras  ', 'Proceso de abastecimiento');
    expect(item.name).toBe('Compras'); expect(item.description).toBe('Proceso de abastecimiento');
    expect(await investigations.find(item.id)).toEqual(item); expect(await investigations.list()).toEqual([item]);
  });
  it('rechaza datos vacíos o excesivos antes de persistir', () => {
    const investigations = service();
    expect(() => investigations.create('   ')).toThrow('Revisa');
    expect(() => investigations.create('a'.repeat(121))).toThrow('Revisa');
    expect(() => investigations.create('Compras', 'a'.repeat(2001))).toThrow('Revisa');
  });
  it('distingue una investigación inexistente de una lista vacía', async () => {
    const investigations = service(); expect(await investigations.list()).toEqual([]);
    await expect(investigations.find('missing')).rejects.toThrow('no existe');
  });
});
