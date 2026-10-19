import type { Pool } from 'pg';
import { z } from 'zod';
import { boardContentSchema } from '@traceboard/contracts';
import type { InvestigationsRepository, StoredBoard } from '../application/investigations.js';
import { InvalidInvestigationError, InvestigationNotFoundError, RepositoryUnavailableError, type Investigation } from '../domain/investigation.js';
import { BoardConflictError, assertBoardIntegrity, type BoardContent } from '../domain/board.js';
const rowSchema = z.object({ public_id: z.uuid(), name: z.string(), description: z.string(), created_at: z.date(), updated_at: z.date() });
const columns = 'public_id, name, description, created_at, updated_at';
function fromRow(row: unknown): Investigation {
  const record = rowSchema.parse(row);
  return { id: record.public_id, name: record.name, description: record.description, createdAt: record.created_at.toISOString(), updatedAt: record.updated_at.toISOString() };
}
export class PostgresInvestigationsRepository implements InvestigationsRepository {
  constructor(private readonly pool: Pool) {}
  async create(investigation: Investigation): Promise<Investigation> {
    try {
      const result = await this.pool.query(`INSERT INTO investigations (public_id, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,$5) RETURNING ${columns}`, [investigation.id, investigation.name, investigation.description, investigation.createdAt, investigation.updatedAt]);
      return fromRow(result.rows[0]);
    } catch { throw new RepositoryUnavailableError('No se pudo guardar la investigación'); }
  }
  async list(): Promise<Investigation[]> {
    try { const result = await this.pool.query(`SELECT ${columns} FROM investigations ORDER BY updated_at DESC, id DESC LIMIT 500`); return result.rows.map(fromRow); }
    catch { throw new RepositoryUnavailableError('No se pudo consultar las investigaciones'); }
  }
  async find(id: string): Promise<Investigation | null> {
    try { const result = await this.pool.query(`SELECT ${columns} FROM investigations WHERE public_id = $1`, [id]); return result.rows.length ? fromRow(result.rows[0]) : null; }
    catch { throw new RepositoryUnavailableError('No se pudo recuperar la investigación'); }
  }
  async board(id: string): Promise<StoredBoard | null> {
    try {
      const result = await this.pool.query(`SELECT ${columns}, board_content, board_revision FROM investigations WHERE public_id=$1`, [id]);
      return result.rows.length ? fromBoardRow(result.rows[0]) : null;
    } catch { throw new RepositoryUnavailableError('No se pudo recuperar el tablero'); }
  }
  async saveBoard(id: string, revision: number, content: BoardContent, now: string): Promise<StoredBoard> {
    try {
      const assets = content.assets.filter(asset => asset.file);
      if (assets.length) {
        const files = await this.pool.query('SELECT f.public_id, f.name, f.mime, f.size, f.sha256 FROM investigation_files f JOIN investigations i ON i.id=f.investigation_id WHERE i.public_id=$1 AND f.public_id=ANY($2::uuid[])', [id, assets.map(asset => asset.file!.id)]);
        const metadata = z.array(z.object({ public_id: z.uuid(), name: z.string(), mime: z.string(), size: z.number(), sha256: z.string() })).parse(files.rows);
        if (assets.some(asset => !metadata.some(file => file.public_id === asset.file?.id && file.name === asset.name && file.mime === asset.mime && file.size === asset.size && file.sha256 === asset.file.sha256))) throw new InvalidInvestigationError('El archivo no pertenece a esta investigación o sus metadatos no coinciden');
      }
      const result = await this.pool.query(`UPDATE investigations SET board_content=$1::jsonb, board_revision=board_revision+1, updated_at=$2 WHERE public_id=$3 AND board_revision=$4 RETURNING ${columns}, board_content, board_revision`, [JSON.stringify(content), now, id, revision]);
      if (result.rows.length) return fromBoardRow(result.rows[0]);
      if (!await this.find(id)) throw new InvestigationNotFoundError('La investigación no existe');
      throw new BoardConflictError('Otra sesión guardó una versión más reciente. Conserva tu copia local y reabre la investigación antes de guardar.');
    } catch (error) {
      if (error instanceof BoardConflictError || error instanceof InvestigationNotFoundError || error instanceof InvalidInvestigationError) throw error;
      throw new RepositoryUnavailableError('No se pudo guardar el tablero. Tu copia local se conserva.');
    }
  }
  async remove(id: string): Promise<boolean> {
    // Una sola sentencia: los archivos y la investigación se eliminan juntos o no se elimina nada.
    try {
      const result = await this.pool.query(`WITH target AS (SELECT id FROM investigations WHERE public_id=$1), removed_files AS (DELETE FROM investigation_files WHERE investigation_id IN (SELECT id FROM target))
        DELETE FROM investigations WHERE id IN (SELECT id FROM target) RETURNING public_id`, [id]);
      return result.rows.length > 0;
    } catch { throw new RepositoryUnavailableError('No se pudo eliminar la investigación'); }
  }
}
function fromBoardRow(row: unknown): StoredBoard {
  const data = z.object({ board_revision: z.number().int().min(0), board_content: boardContentSchema.nullable() }).parse(row);
  if (data.board_content) assertBoardIntegrity(data.board_content);
  return { investigation: fromRow(row), revision: data.board_revision, content: data.board_content };
}
