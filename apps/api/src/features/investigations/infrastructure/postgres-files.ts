import type { Pool } from 'pg';
import { z } from 'zod';
import { fileDtoSchema } from '@traceboard/contracts';
import type { FilesRepository } from '../application/files.js';
import type { StoredFile, StoredFileInfo } from '../domain/file.js';
import { InvestigationNotFoundError, RepositoryUnavailableError } from '../domain/investigation.js';
const columns = 'f.public_id, i.public_id AS investigation_public_id, f.name, f.mime, f.size, f.sha256, f.created_at';
function info(row: unknown): StoredFileInfo {
  const data = z.object({ public_id: z.uuid(), investigation_public_id: z.uuid(), name: z.string(), mime: z.string(), size: z.number(), sha256: z.string(), created_at: z.date() }).parse(row);
  return fileDtoSchema.parse({ id: data.public_id, investigationId: data.investigation_public_id, name: data.name, mime: data.mime, size: data.size, sha256: data.sha256, createdAt: data.created_at.toISOString() });
}
export class PostgresFilesRepository implements FilesRepository {
  constructor(private readonly pool: Pool) {}
  async store(file: StoredFile): Promise<StoredFileInfo> {
    try {
      // Immutable and deduplicated. Retry/parallel upload never replaces existing bytes.
      await this.pool.query(`INSERT INTO investigation_files (public_id,investigation_id,name,mime,size,sha256,content,created_at) SELECT $1,id,$3,$4,$5,$6,$7,$8 FROM investigations WHERE public_id=$2 ON CONFLICT (investigation_id,name,sha256) DO NOTHING`, [file.info.id, file.info.investigationId, file.info.name, file.info.mime, file.info.size, file.info.sha256, Buffer.from(file.bytes), file.info.createdAt]);
      const result = await this.pool.query(`SELECT ${columns} FROM investigation_files f JOIN investigations i ON i.id=f.investigation_id WHERE i.public_id=$1 AND f.name=$2 AND f.sha256=$3`, [file.info.investigationId, file.info.name, file.info.sha256]);
      if (!result.rows.length) throw new InvestigationNotFoundError('La investigación no existe');
      return info(result.rows[0]);
    } catch (error) {
      if (error instanceof InvestigationNotFoundError) throw error;
      throw new RepositoryUnavailableError('No se pudo guardar el archivo. Tu copia local se conserva.');
    }
  }
  async find(investigationId: string, fileId: string): Promise<StoredFile | null> {
    try {
      const result = await this.pool.query(`SELECT ${columns}, f.content FROM investigation_files f JOIN investigations i ON i.id=f.investigation_id WHERE i.public_id=$1 AND f.public_id=$2`, [investigationId, fileId]);
      if (!result.rows.length) return null;
      const bytes = z.object({ content: z.instanceof(Uint8Array) }).parse(result.rows[0]).content;
      const metadata = info(result.rows[0]);
      if (bytes.length !== metadata.size) throw new Error('Invalid content');
      return { info: metadata, bytes };
    } catch { throw new RepositoryUnavailableError('No se pudo recuperar el archivo'); }
  }
}
