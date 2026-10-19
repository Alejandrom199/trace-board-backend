import type { BoardContentDto } from '@traceboard/contracts';
import { InvalidInvestigationError } from './investigation.js';

// This transport type contains only plain data, with no UI or persistence dependencies.
export type BoardContent = BoardContentDto;
export class BoardConflictError extends Error {}
// Cada tipo con atributos estructurados exige su propiedad; ningún otro tipo puede tenerla.
const attributeKeys = [['requirement', 'requirement'], ['actor', 'actor'], ['problem', 'problem'], ['business_rule', 'businessRule'], ['question', 'question'], ['decision', 'decision']] as const;
type Entity = BoardContent['entities'][number];
function hasConsistentAttributes(item: Entity): boolean {
  return attributeKeys.every(([kind, key]) => (item.kind === kind) === (item[key] !== undefined))
    && (!item.requirement || (item.requirement.type === 'non_functional') === (item.requirement.category !== undefined));
}
export function assertBoardIntegrity(board: BoardContent): void {
  const nodes = new Set(board.entities.map(item => item.id));
  const assets = new Set(board.assets.map(item => item.id));
  const positions = new Set(board.elements.map(item => item.nodeId));
  const codes = board.entities.flatMap(item => { const code = item.requirement?.code ?? item.businessRule?.code ?? item.decision?.code; return code === undefined ? [] : [code.trim().toUpperCase()]; });
  const invalid = nodes.size !== board.entities.length || assets.size !== board.assets.length
    || new Set(board.edges.map(item => item.id)).size !== board.edges.length
    || codes.some(code => !code) || new Set(codes).size !== codes.length
    || positions.size !== board.elements.length || positions.size !== nodes.size
    || board.elements.some(item => !nodes.has(item.nodeId))
    || board.entities.some(item => !hasConsistentAttributes(item) || (item.assetId && !assets.has(item.assetId)));
  const triples = board.edges.map(item => JSON.stringify([item.sourceId, item.targetId, item.relation]));
  if (invalid || new Set(triples).size !== triples.length || board.edges.some(item => item.sourceId === item.targetId || !nodes.has(item.sourceId) || !nodes.has(item.targetId))) {
    throw new InvalidInvestigationError('El tablero contiene referencias, posiciones o identificadores incoherentes');
  }
}
