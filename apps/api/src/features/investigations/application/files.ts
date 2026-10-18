import { validateFile, FileNotFoundError, type StoredFile, type StoredFileInfo } from '../domain/file.js';
export interface FilesRepository {
  store(file: StoredFile): Promise<StoredFileInfo>;
  find(investigationId: string, fileId: string): Promise<StoredFile | null>;
}
export class InvestigationFiles {
  constructor(private readonly repository: FilesRepository, private readonly values: { id(): string; now(): string; hash(bytes: Uint8Array): string }) {}
  upload(investigationId: string, name: string, mime: string, bytes: Uint8Array) {
    const valid = validateFile(name, mime, bytes);
    return this.repository.store({ info: { ...valid, id: this.values.id(), investigationId, sha256: this.values.hash(bytes), createdAt: this.values.now() }, bytes });
  }
  async find(investigationId: string, fileId: string) {
    const file = await this.repository.find(investigationId, fileId);
    if (!file) throw new FileNotFoundError('El archivo no está disponible en esta investigación');
    return file;
  }
}
