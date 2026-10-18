import { describe, expect, it } from 'vitest';
import { assertBoardIntegrity, type BoardContent } from './board.js';

const now = '2026-10-13T18:00:00.000Z';
function content(): BoardContent {
  return {
    entities: [
      { id: 'doc', kind: 'document', title: 'Entrevista', description: '', createdAt: now, updatedAt: now },
      { id: 'finding', kind: 'finding', title: 'Stock desactualizado', description: '', createdAt: now, updatedAt: now },
      { id: 'req', kind: 'requirement', title: 'Actualizar stock', description: '', createdAt: now, updatedAt: now, requirement: { code: 'RF-001', priority: 'high', status: 'draft', criteria: ['Registrar cada venta'] } },
    ],
    edges: [
      { id: 'e1', sourceId: 'doc', targetId: 'finding', relation: 'evidences', description: '', createdAt: now, metadata: {} },
      { id: 'e2', sourceId: 'finding', targetId: 'req', relation: 'originates', description: '', createdAt: now, metadata: {} },
    ], elements: [{ nodeId: 'doc', x: 0, y: 0 }, { nodeId: 'finding', x: 300, y: 0 }, { nodeId: 'req', x: 600, y: 0 }], assets: [],
  };
}
describe('Integridad del tablero', () => {
  it('acepta evidencia, hallazgo y requisito conectados', () => expect(() => assertBoardIntegrity(content())).not.toThrow());
  it('rechaza referencias huérfanas y autorrelaciones', () => {
    const board = content(); board.edges[0]!.sourceId = 'missing'; expect(() => assertBoardIntegrity(board)).toThrow('incoherentes');
    board.edges[0]!.sourceId = 'finding'; expect(() => assertBoardIntegrity(board)).toThrow('incoherentes');
  });
  it('rechaza posiciones ausentes y duplicadas', () => {
    const board = content(); board.elements.pop(); expect(() => assertBoardIntegrity(board)).toThrow();
    board.elements.push(board.elements[0]!); expect(() => assertBoardIntegrity(board)).toThrow();
  });
  it('rechaza archivos inexistentes y requisitos sin propiedades', () => {
    const board = content(); board.entities[0]!.assetId = 'missing'; expect(() => assertBoardIntegrity(board)).toThrow();
    delete board.entities[0]!.assetId; delete board.entities[2]!.requirement; expect(() => assertBoardIntegrity(board)).toThrow();
  });
  it('rechaza relaciones duplicadas y códigos duplicados sin distinguir mayúsculas', () => {
    const board = content(); board.edges.push({ ...board.edges[0]!, id: 'different' }); expect(() => assertBoardIntegrity(board)).toThrow();
    board.edges.pop(); board.entities[1]!.requirement = { ...board.entities[2]!.requirement!, code: 'rf-001' }; expect(() => assertBoardIntegrity(board)).toThrow();
  });
});
