import { InvalidInvestigationError } from './investigation.js';
import type { FileDto } from '@traceboard/contracts';
export type StoredFileInfo = FileDto;
export interface StoredFile { info: StoredFileInfo; bytes: Uint8Array }
export class FileNotFoundError extends Error {}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export function validateFile(name: string, declaredMime: string, bytes: Uint8Array): { name: string; mime: FileDto['mime']; size: number } {
  if (!name.trim() || name.length > 250 || /[\u0000-\u001f\u007f/\\]/.test(name) || name !== name.trim()) throw new InvalidInvestigationError('El nombre del archivo no es válido');
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new InvalidInvestigationError('Cada archivo admite hasta 10 MB y no puede estar vacío');
  const starts = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);
  const extension = name.split('.').at(-1)?.toLowerCase();
  let mime: FileDto['mime'] | undefined;
  if (extension === 'png' && starts([137, 80, 78, 71, 13, 10, 26, 10])) mime = 'image/png';
  if (['jpg', 'jpeg'].includes(extension ?? '') && starts([255, 216, 255])) mime = 'image/jpeg';
  if (extension === 'gif' && (starts([71, 73, 70, 56, 55, 97]) || starts([71, 73, 70, 56, 57, 97]))) mime = 'image/gif';
  if (extension === 'webp' && starts([82, 73, 70, 70]) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) mime = 'image/webp';
  if (extension === 'pdf' && starts([37, 80, 68, 70, 45])) mime = 'application/pdf';
  if (!mime || mime !== declaredMime) throw new InvalidInvestigationError('Usa PDF o imagen PNG/JPG/GIF/WebP con contenido y extensión coincidentes');
  return { name, mime, size: bytes.length };
}
