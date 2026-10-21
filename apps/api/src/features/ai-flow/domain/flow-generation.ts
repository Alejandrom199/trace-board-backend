import { aiGeneratedFlowSchema, type AiGeneratedFlow } from '@traceboard/contracts';

export class InvalidDocumentError extends Error {}
export class AiGenerationError extends Error {}
export class AiUpstreamError extends Error {}
export class AiNotConfiguredError extends Error {}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 20000;
export const MIN_EXTRACTED_CHARS = 40;

const extensionMime: Record<string, 'application/pdf' | 'text/plain' | 'text/markdown'> = {
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
};

/** Un nombre de archivo válido no trae separadores de ruta ni caracteres de control. */
function hasInvalidCharacters(name: string): boolean {
  return Array.from(name).some(character => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127 || character === '/' || character === '\\';
  });
}

/** Nombre, tipo declarado y bytes del documento subido para generar un flujo; solo texto extraíble en esta etapa. */
export function validateDocument(name: string, declaredMime: string, bytes: Uint8Array): { name: string; mime: 'application/pdf' | 'text/plain' | 'text/markdown' } {
  if (!name.trim() || name.length > 250 || name !== name.trim() || hasInvalidCharacters(name)) throw new InvalidDocumentError('El nombre del archivo no es válido');
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new InvalidDocumentError('El documento admite hasta 10 MB para generar un flujo con IA');
  const extension = name.split('.').at(-1)?.toLowerCase();
  const mime = extension ? extensionMime[extension] : undefined;
  if (!mime || mime !== declaredMime) throw new InvalidDocumentError('Usa un PDF con texto, o un archivo .txt/.md, con extensión y tipo coincidentes');
  return { name, mime };
}

/** Recorta el texto extraído al presupuesto de contexto del modelo gratuito; exige un mínimo legible. */
export function clampExtractedText(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXTRACTED_CHARS) throw new InvalidDocumentError('El documento no tiene suficiente texto legible para proponer un flujo');
  const truncated = trimmed.length > MAX_EXTRACTED_CHARS;
  return { text: truncated ? trimmed.slice(0, MAX_EXTRACTED_CHARS) : trimmed, truncated };
}

/** Extrae el primer objeto JSON de la respuesta del modelo (puede venir en una valla ```json) y lo valida contra el contrato. */
export function parseModelOutput(raw: string): AiGeneratedFlow {
  const withoutFence = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new AiGenerationError('La IA no devolvió un flujo en formato JSON');
  let parsed: unknown;
  try { parsed = JSON.parse(withoutFence.slice(start, end + 1)); } catch { throw new AiGenerationError('La IA no devolvió JSON válido'); }
  const result = aiGeneratedFlowSchema.safeParse(parsed);
  if (!result.success) throw new AiGenerationError('La IA devolvió un flujo con un formato inesperado. Inténtalo de nuevo.');
  return result.data;
}
