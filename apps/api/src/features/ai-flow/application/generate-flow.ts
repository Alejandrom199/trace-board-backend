import type { AiGeneratedFlow } from '@traceboard/contracts';
import { validateDocument, clampExtractedText, parseModelOutput } from '../domain/flow-generation.js';

export interface DocumentTextPort { extract(bytes: Uint8Array, mime: string): Promise<string> }
export interface FlowModelPort { complete(prompt: string): Promise<string> }
export interface GeneratedFlowResult { flow: AiGeneratedFlow; truncated: boolean }

const INSTRUCTIONS = `Eres un analista de negocio. Lee el extracto de un documento (acta, manual o entrevista) y propone, en español, el flujo de actores, procesos y reglas que describe.
Responde ÚNICAMENTE un objeto JSON, sin texto adicional ni explicaciones, con esta forma exacta:
{"entities":[{"ref":"e1","kind":"actor","title":"...","description":"..."}],"relations":[{"from":"e1","to":"e2","relation":"performs","flow":false}]}
Reglas:
- "ref" es un identificador corto y único dentro de la respuesta (e1, e2, e3...).
- "kind" es uno de: finding, problem, question, actor, process, business_rule, external_system, requirement, decision.
- Si "kind" es "actor", añade "actor":{"category":"user"|"stakeholder"|"area"}.
- Si "kind" es "requirement", añade "requirement":{"type":"functional"|"non_functional"}.
- Si "kind" es "problem", añade "problem":{"severity":"low"|"medium"|"high"|"critical"}.
- "relation" es uno de: evidences, depends_on, contradicts, originates, affects, implements, references, related_to, performs, answers.
- Usa "flow":true solo en relaciones que representan el siguiente paso de un proceso secuencial.
- Propón como máximo 15 entidades y prioriza el proceso principal sobre detalles secundarios.
- No inventes datos que el texto no sustente; usa descripciones breves basadas en el extracto.`;

function buildPrompt(text: string): string {
  return `${INSTRUCTIONS}\n\nExtracto del documento:\n"""\n${text}\n"""`;
}

/** Caso de uso: documento subido -> texto -> modelo de IA -> flujo propuesto validado. Sin persistencia; la revisión y el alta en el tablero ocurren en el cliente. */
export class AiFlowGenerator {
  constructor(private readonly textPort: DocumentTextPort, private readonly model: FlowModelPort) {}
  async generate(name: string, declaredMime: string, bytes: Uint8Array): Promise<GeneratedFlowResult> {
    const file = validateDocument(name, declaredMime, bytes);
    const extracted = await this.textPort.extract(bytes, file.mime);
    const { text, truncated } = clampExtractedText(extracted);
    const completion = await this.model.complete(buildPrompt(text));
    const flow = parseModelOutput(completion);
    return { flow, truncated };
  }
}
