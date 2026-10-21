import { describe, expect, it } from 'vitest';
import { MAX_DOCUMENT_BYTES, MIN_EXTRACTED_CHARS, clampExtractedText, parseModelOutput, validateDocument } from './flow-generation.js';

describe('Validación de documentos para generar flujo con IA', () => {
  it.each([
    ['acta.pdf', 'application/pdf'], ['notas.txt', 'text/plain'], ['notas.md', 'text/markdown'], ['notas.markdown', 'text/markdown'],
  ])('reconoce %s por extensión y MIME', (name, mime) => {
    expect(validateDocument(name, mime, new Uint8Array([1, 2, 3]))).toEqual({ name, mime });
  });
  it('rechaza nombres de rutas y caracteres de control', () => {
    for (const name of ['../x.pdf', 'C:\\x.pdf', 'x\n.pdf', '', ' x.pdf']) expect(() => validateDocument(name, 'application/pdf', new Uint8Array([1]))).toThrow('nombre');
  });
  it('rechaza archivos vacíos, demasiado grandes o con extensión/MIME que no coinciden', () => {
    expect(() => validateDocument('x.pdf', 'application/pdf', new Uint8Array())).toThrow('10 MB');
    expect(() => validateDocument('x.pdf', 'application/pdf', new Uint8Array(MAX_DOCUMENT_BYTES + 1))).toThrow('10 MB');
    expect(() => validateDocument('x.docx', 'application/pdf', new Uint8Array([1]))).toThrow('PDF');
    expect(() => validateDocument('x.pdf', 'text/plain', new Uint8Array([1]))).toThrow('PDF');
  });
});

describe('Recorte del texto extraído', () => {
  it('exige un mínimo de texto legible', () => {
    expect(() => clampExtractedText('a'.repeat(MIN_EXTRACTED_CHARS - 1))).toThrow('suficiente texto');
  });
  it('recorta el texto que supera el presupuesto y lo marca como truncado', () => {
    const long = 'a'.repeat(30000);
    const result = clampExtractedText(long);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(20000);
  });
  it('no marca como truncado un texto dentro del presupuesto', () => {
    const text = 'Acta de reunión. '.repeat(10);
    expect(clampExtractedText(text)).toEqual({ text: text.trim(), truncated: false });
  });
});

describe('Interpretación de la respuesta del modelo', () => {
  const validFlow = { entities: [{ ref: 'e1', kind: 'actor', title: 'Cliente', description: '', actor: { category: 'user' } }], relations: [] };
  it('acepta JSON plano', () => {
    expect(parseModelOutput(JSON.stringify(validFlow)).entities).toHaveLength(1);
  });
  it('acepta JSON dentro de una valla ```json', () => {
    expect(parseModelOutput('```json\n' + JSON.stringify(validFlow) + '\n```').entities).toHaveLength(1);
  });
  it('ignora texto alrededor del primer objeto JSON', () => {
    expect(parseModelOutput('Aquí tienes el flujo:\n' + JSON.stringify(validFlow) + '\nFin.').entities).toHaveLength(1);
  });
  it('rechaza una respuesta sin JSON', () => {
    expect(() => parseModelOutput('No puedo generar un flujo.')).toThrow('JSON');
  });
  it('rechaza JSON mal formado', () => {
    expect(() => parseModelOutput('{"entities": [')).toThrow('JSON');
  });
  it('rechaza un flujo que no cumple el contrato', () => {
    expect(() => parseModelOutput(JSON.stringify({ entities: [{ ref: 'e1', kind: 'actor', title: 'Cliente' }], relations: [] }))).toThrow('formato inesperado');
  });
  it('rechaza relaciones con referencias inexistentes', () => {
    const flow = { entities: validFlow.entities, relations: [{ from: 'e1', to: 'e2', relation: 'performs' }] };
    expect(() => parseModelOutput(JSON.stringify(flow))).toThrow('formato inesperado');
  });
});
