import type { FilesRepository } from '../application/files.js';
import type { InvestigationsRepository, StoredBoard } from '../application/investigations.js';
import { BoardConflictError, assertBoardIntegrity, type BoardContent } from '../domain/board.js';
import type { StoredFile, StoredFileInfo } from '../domain/file.js';
import { InvalidInvestigationError, InvestigationNotFoundError, RepositoryUnavailableError, type Investigation } from '../domain/investigation.js';

interface MemoryInvestigation {
  investigation: Investigation;
  revision: number;
  content: BoardContent | null;
}
const MAX_INVESTIGATIONS = 500;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const clone = <T>(value: T): T => structuredClone(value);
const fileKey = (investigationId: string, fileId: string) => investigationId + ':' + fileId;

export class InMemoryTraceBoardStore {
  readonly investigations = new Map<string, MemoryInvestigation>();
  readonly files = new Map<string, StoredFile>();
  totalFileBytes = 0;
}
export class InMemoryInvestigationsRepository implements InvestigationsRepository {
  constructor(private readonly store: InMemoryTraceBoardStore) {}
  async create(investigation: Investigation): Promise<Investigation> {
    if (this.store.investigations.size >= MAX_INVESTIGATIONS) throw new RepositoryUnavailableError('El almacenamiento temporal alcanzó su capacidad');
    this.store.investigations.set(investigation.id, { investigation: clone(investigation), revision: 0, content: null });
    return clone(investigation);
  }
  async list(): Promise<Investigation[]> {
    return [...this.store.investigations.values()].map(record => clone(record.investigation))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, MAX_INVESTIGATIONS);
  }
  async find(id: string): Promise<Investigation | null> {
    const record = this.store.investigations.get(id);
    return record ? clone(record.investigation) : null;
  }
  async board(id: string): Promise<StoredBoard | null> {
    const record = this.store.investigations.get(id);
    return record ? clone({ investigation: record.investigation, revision: record.revision, content: record.content }) : null;
  }
  async saveBoard(id: string, revision: number, content: BoardContent, now: string): Promise<StoredBoard> {
    assertBoardIntegrity(content);
    const record = this.store.investigations.get(id);
    if (!record) throw new InvestigationNotFoundError('La investigación no existe');
    if (record.revision !== revision) throw new BoardConflictError('Otra sesión guardó una versión más reciente. Conserva tu copia local y reabre la investigación antes de guardar.');
    for (const asset of content.assets.filter(candidate => candidate.file)) {
      const file = this.store.files.get(fileKey(id, asset.file!.id));
      if (!file || file.info.name !== asset.name || file.info.mime !== asset.mime || file.info.size !== asset.size || file.info.sha256 !== asset.file!.sha256) {
        throw new InvalidInvestigationError('El archivo no pertenece a esta investigación o sus metadatos no coinciden');
      }
    }
    record.content = clone(content);
    record.revision++;
    record.investigation.updatedAt = now;
    return clone({ investigation: record.investigation, revision: record.revision, content: record.content });
  }
}
export class InMemoryFilesRepository implements FilesRepository {
  constructor(private readonly state: InMemoryTraceBoardStore) {}
  async store(file: StoredFile): Promise<StoredFileInfo> {
    if (!this.state.investigations.has(file.info.investigationId)) throw new InvestigationNotFoundError('La investigación no existe');
    const duplicate = [...this.state.files.values()].find(candidate => candidate.info.investigationId === file.info.investigationId && candidate.info.name === file.info.name && candidate.info.sha256 === file.info.sha256);
    if (duplicate) return clone(duplicate.info);
    if (this.state.totalFileBytes + file.bytes.byteLength > MAX_FILE_BYTES) throw new RepositoryUnavailableError('El almacenamiento temporal de archivos alcanzó su capacidad');
    this.state.files.set(fileKey(file.info.investigationId, file.info.id), { info: clone(file.info), bytes: file.bytes.slice() });
    this.state.totalFileBytes += file.bytes.byteLength;
    return clone(file.info);
  }
  async find(investigationId: string, fileId: string): Promise<StoredFile | null> {
    const file = this.state.files.get(fileKey(investigationId, fileId));
    return file ? { info: clone(file.info), bytes: file.bytes.slice() } : null;
  }
}
