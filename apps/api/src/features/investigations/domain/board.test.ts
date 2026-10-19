import { describe, expect, it } from 'vitest';
import { boardContentSchema } from '@traceboard/contracts';
import { assertBoardIntegrity, type BoardContent } from './board.js';

const now = '2026-10-13T18:00:00.000Z';
function content(): BoardContent {
  return {
    entities: [
      { id: 'doc', kind: 'document', title: 'Entrevista', description: '', createdAt: now, updatedAt: now },
      { id: 'finding', kind: 'finding', title: 'Stock desactualizado', description: '', createdAt: now, updatedAt: now },
      { id: 'req', kind: 'requirement', title: 'Actualizar stock', description: '', createdAt: now, updatedAt: now, requirement: { code: 'RF-001', type: 'functional', priority: 'high', status: 'draft', criteria: ['Registrar cada venta'] } },
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
  it('acepta los tipos de análisis, negocio y solución con sus atributos', () => {
    const board = content();
    board.entities.push(
      { id: 'actor', kind: 'actor', title: 'Bodeguero', description: '', createdAt: now, updatedAt: now, actor: { category: 'user' } },
      { id: 'rule', kind: 'business_rule', title: 'Sin stock negativo', description: '', createdAt: now, updatedAt: now, businessRule: { code: 'RN-001' } },
      { id: 'decision', kind: 'decision', title: 'Usar eventos', description: '', createdAt: now, updatedAt: now, decision: { code: 'DEC-001', status: 'accepted', rationale: 'Auditoría' } },
      { id: 'system', kind: 'external_system', title: 'ERP', description: '', createdAt: now, updatedAt: now },
    );
    board.elements.push({ nodeId: 'actor', x: 0, y: 300 }, { nodeId: 'rule', x: 300, y: 300 }, { nodeId: 'decision', x: 600, y: 300 }, { nodeId: 'system', x: 900, y: 300 });
    board.edges.push({ id: 'e3', sourceId: 'actor', targetId: 'finding', relation: 'performs', description: '', createdAt: now, metadata: {} });
    expect(() => assertBoardIntegrity(board)).not.toThrow();
    board.entities[3]!.businessRule = { code: 'rf-001' }; expect(() => assertBoardIntegrity(board)).toThrow();
  });
  it('rechaza atributos ausentes, de otro tipo o una categoría en un requisito funcional', () => {
    const board = content(); board.entities[1]!.actor = { category: 'area' }; expect(() => assertBoardIntegrity(board)).toThrow();
    delete board.entities[1]!.actor; board.entities[2]!.requirement!.category = 'security'; expect(() => assertBoardIntegrity(board)).toThrow();
  });
  it('el contrato interpreta como funcional un requisito guardado sin tipo y rechaza propiedades desconocidas', () => {
    const legacy = { ...content(), entities: content().entities.map(({ requirement, ...item }) => requirement ? { ...item, requirement: { code: requirement.code, priority: requirement.priority, status: requirement.status, criteria: requirement.criteria } } : item) };
    expect(boardContentSchema.parse(legacy).entities[2]?.requirement?.type).toBe('functional');
    expect(boardContentSchema.safeParse({ ...legacy, entities: [{ ...legacy.entities[0], actor: { category: 'user', extra: 1 } }] }).success).toBe(false);
  });
});
