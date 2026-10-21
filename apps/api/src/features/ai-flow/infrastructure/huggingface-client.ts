import type { FlowModelPort } from '../application/generate-flow.js';
import { AiNotConfiguredError, AiUpstreamError } from '../domain/flow-generation.js';

const ENDPOINT = 'https://router.huggingface.co/v1/chat/completions';

export interface HuggingFaceConfig { token?: string; model: string }

/** Adaptador: Hugging Face Inference Providers (API compatible con chat completions), usado en su capa gratuita.
 * El modelo es configurable (HF_MODEL) porque la disponibilidad gratuita de modelos concretos cambia con el tiempo. */
export class HuggingFaceFlowModel implements FlowModelPort {
  constructor(private readonly config: HuggingFaceConfig) {}
  async complete(prompt: string): Promise<string> {
    if (!this.config.token) throw new AiNotConfiguredError('La generación de flujo con IA no está configurada en este servidor (falta HF_API_TOKEN)');
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.config.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, temperature: 0.2, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(60000),
      });
    } catch { throw new AiUpstreamError('No se pudo contactar al servicio de Hugging Face. Inténtalo de nuevo.'); }
    if (!response.ok) throw new AiUpstreamError(`El servicio de Hugging Face respondió con un error (${response.status}). Verifica HF_API_TOKEN y HF_MODEL.`);
    let data: unknown;
    try { data = await response.json(); } catch { throw new AiUpstreamError('El servicio de Hugging Face devolvió una respuesta ilegible.'); }
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new AiUpstreamError('El servicio de Hugging Face no devolvió contenido.');
    return content;
  }
}
