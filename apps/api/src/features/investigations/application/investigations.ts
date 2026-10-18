import { makeInvestigation, InvestigationNotFoundError, type Investigation } from '../domain/investigation.js';
import { assertBoardIntegrity, type BoardContent } from '../domain/board.js';
export interface StoredBoard { investigation: Investigation; revision: number; content: BoardContent | null }
export interface InvestigationsRepository {
  create(investigation: Investigation): Promise<Investigation>; list(): Promise<Investigation[]>; find(id: string): Promise<Investigation | null>;
  board(id: string): Promise<StoredBoard | null>;
  saveBoard(id: string, revision: number, content: BoardContent, now: string): Promise<StoredBoard>;
}
export class Investigations {
  constructor(private readonly repository: InvestigationsRepository, private readonly values: { id(): string; now(): string }) {}
  create(name: string, description = '') { return this.repository.create(makeInvestigation(this.values.id(), name, description, this.values.now())); }
  list() { return this.repository.list(); }
  async find(id: string) {
    const investigation = await this.repository.find(id);
    if (!investigation) throw new InvestigationNotFoundError('La investigación no existe');
    return investigation;
  }
  async board(id: string) {
    const board = await this.repository.board(id);
    if (!board) throw new InvestigationNotFoundError('La investigación no existe');
    return board;
  }
  saveBoard(id: string, revision: number, content: BoardContent) {
    assertBoardIntegrity(content);
    return this.repository.saveBoard(id, revision, content, this.values.now());
  }
}
