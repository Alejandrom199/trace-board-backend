import { Body, Controller, Headers, Inject, Post, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { aiGenerateFlowResponseSchema } from '@traceboard/contracts';
import type { AiFlowGenerator } from '../application/generate-flow.js';

export const AI_FLOW = 'TRACEBOARD_AI_FLOW';

@Controller('ai')
export class AiController {
  constructor(@Inject(AI_FLOW) private readonly generator: AiFlowGenerator) {}

  @Post('generate-flow')
  async generateFlow(@Body() body: unknown, @Headers('content-type') type?: string, @Headers('x-file-name') encodedName?: string, @Headers('x-file-mime') mime?: string) {
    if (!/^application\/octet-stream(?:\s*;|$)/i.test(type ?? '')) throw new UnsupportedMediaTypeException('Envía los bytes del documento como application/octet-stream');
    if (!Buffer.isBuffer(body)) throw new BadRequestException('Documento ilegible');
    let name: string;
    try { name = decodeURIComponent(encodedName ?? ''); } catch { throw new BadRequestException('Nombre de archivo inválido'); }
    const { flow, truncated } = await this.generator.generate(name, mime ?? '', body);
    return aiGenerateFlowResponseSchema.parse({ flow, truncated });
  }
}
