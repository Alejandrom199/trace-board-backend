import type { DocumentTextPort } from '../application/generate-flow.js';
import { InvalidDocumentError } from '../domain/flow-generation.js';

/** Adaptador: bytes de PDF o texto plano -> texto. Único punto del feature que depende de una librería de parseo. */
export class DocumentTextExtractor implements DocumentTextPort {
  async extract(bytes: Uint8Array, mime: string): Promise<string> {
    if (mime === 'application/pdf') {
      const { default: pdfParse } = await import('pdf-parse');
      try {
        const result = await pdfParse(Buffer.from(bytes));
        return result.text;
      } catch { throw new InvalidDocumentError('No se pudo leer el PDF. Asegúrate de que tenga texto, no solo imágenes escaneadas.'); }
    }
    return Buffer.from(bytes).toString('utf-8');
  }
}
