import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, validateFile } from './file.js';
describe('Validación de archivos independiente del framework', () => {
  it.each([
    ['evidencia.png', 'image/png', [137,80,78,71,13,10,26,10]],
    ['evidencia.jpg', 'image/jpeg', [255,216,255]],
    ['evidencia.gif', 'image/gif', [71,73,70,56,57,97]],
    ['evidencia.webp', 'image/webp', [82,73,70,70,0,0,0,0,87,69,66,80]],
    ['entrevista.pdf', 'application/pdf', [37,80,68,70,45]],
  ])('reconoce %s por extensión, MIME y firma', (name, mime, values) => {
    const bytes = new Uint8Array(values); expect(validateFile(name, mime, bytes)).toEqual({ name, mime, size: bytes.length });
  });
  it('rechaza nombres de rutas y caracteres de control', () => {
    for (const name of ['../x.pdf', 'C:\\x.pdf', 'x\n.pdf', '', ' x.pdf']) expect(() => validateFile(name, 'application/pdf', new Uint8Array([37,80,68,70,45]))).toThrow('nombre');
  });
  it('rechaza archivos vacíos, tipos activos y firmas que no coinciden', () => {
    expect(() => validateFile('x.pdf', 'application/pdf', new Uint8Array())).toThrow('vacío');
    expect(() => validateFile('x.svg', 'image/svg+xml', new TextEncoder().encode('<svg/>'))).toThrow('coincidentes');
    expect(() => validateFile('x.png', 'image/png', new Uint8Array([37,80,68,70,45]))).toThrow('coincidentes');
    expect(() => validateFile('x.pdf', 'image/png', new Uint8Array([37,80,68,70,45]))).toThrow('coincidentes');
  });
  it('acepta exactamente 10 MiB y rechaza un byte más', () => {
    const bytes = new Uint8Array(MAX_UPLOAD_BYTES); bytes.set([137,80,78,71,13,10,26,10]);
    expect(validateFile('x.png', 'image/png', bytes).size).toBe(MAX_UPLOAD_BYTES);
    expect(() => validateFile('x.png', 'image/png', new Uint8Array(MAX_UPLOAD_BYTES + 1))).toThrow('10 MB');
  });
});
