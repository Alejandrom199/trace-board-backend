import { describe, expect, it } from 'vitest';
import { AiFlowGenerator, type DocumentTextPort, type FlowModelPort } from './generate-flow.js';
import { InvalidDocumentError } from '../domain/flow-generation.js';

const flowJson = JSON.stringify({
  entities: [
    { ref: 'e1', kind: 'actor', title: 'Cliente', description: 'Solicita el pedido', actor: { category: 'user' } },
    { ref: 'e2', kind: 'process', title: 'Registrar pedido', description: 'Captura los datos del pedido' },
  ],
  relations: [{ from: 'e1', to: 'e2', relation: 'performs', flow: true }],
});

function fakePorts(overrides: Partial<{ text: string; completion: string }> = {}) {
  const calls: { prompt?: string; bytes?: Uint8Array; mime?: string } = {};
  const textPort: DocumentTextPort = { extract: async (bytes, mime) => { calls.bytes = bytes; calls.mime = mime; return overrides.text ?? 'Acta de reunión con el cliente. '.repeat(5); } };
  const model: FlowModelPort = { complete: async prompt => { calls.prompt = prompt; return overrides.completion ?? flowJson; } };
  return { textPort, model, calls };
}

describe('Generador de flujo a partir de un documento', () => {
  it('extrae texto, llama al modelo con el extracto y valida el flujo devuelto', async () => {
    const { textPort, model, calls } = fakePorts();
    const generator = new AiFlowGenerator(textPort, model);
    const result = await generator.generate('acta.txt', 'text/plain', new TextEncoder().encode('contenido'));
    expect(result.flow.entities).toHaveLength(2);
    expect(result.flow.relations[0]).toMatchObject({ from: 'e1', to: 'e2', relation: 'performs', flow: true });
    expect(result.truncated).toBe(false);
    expect(calls.mime).toBe('text/plain');
    expect(calls.prompt).toContain('Acta de reunión');
  });
  it('marca el flujo como truncado cuando el texto excede el presupuesto', async () => {
    const { textPort, model } = fakePorts({ text: 'a'.repeat(30000) });
    const result = await new AiFlowGenerator(textPort, model).generate('acta.txt', 'text/plain', new Uint8Array([1]));
    expect(result.truncated).toBe(true);
  });
  it('rechaza el documento antes de llamar al modelo si no es válido', async () => {
    const { textPort, model } = fakePorts();
    await expect(new AiFlowGenerator(textPort, model).generate('acta.docx', 'application/pdf', new Uint8Array([1]))).rejects.toThrow(InvalidDocumentError);
  });
  it('propaga un error cuando el modelo no devuelve un flujo interpretable', async () => {
    const { textPort, model } = fakePorts({ completion: 'no puedo ayudarte con eso' });
    await expect(new AiFlowGenerator(textPort, model).generate('acta.txt', 'text/plain', new Uint8Array([1]))).rejects.toThrow('JSON');
  });
});
