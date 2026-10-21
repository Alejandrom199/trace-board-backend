import 'reflect-metadata';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { Investigations, INVESTIGATIONS, InvestigationsController, InvestigationErrorFilter, InvestigationFiles, FILES, FilesController, type InvestigationsRepository, type FilesRepository } from './features/investigations/index.js';
import { AiFlowGenerator, AI_FLOW, AiController, AiErrorFilter, DocumentTextExtractor, HuggingFaceFlowModel } from './features/ai-flow/index.js';

export interface ApiDependencies {
  investigations: InvestigationsRepository;
  files: FilesRepository;
  accessToken?: string;
  allowedOrigins?: string[];
  /** Generación de flujo con un modelo gratuito de Hugging Face; sin token, el endpoint responde 503 pero el resto de la API funciona igual. */
  ai?: { token?: string; model: string };
}
@Controller()
class HealthController {
  @Get('health')
  health() { return { status: 'ok' }; }
}
export function isAuthorized(actual: string | undefined, expected: string): boolean {
  if (!actual?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(actual.slice(7));
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}
export async function createApi(dependencies: ApiDependencies): Promise<INestApplication> {
  @Module({ controllers: [HealthController, InvestigationsController, FilesController, AiController], providers: [
    { provide: INVESTIGATIONS, useFactory: () => new Investigations(dependencies.investigations, { id: randomUUID, now: () => new Date().toISOString() }) },
    { provide: FILES, useFactory: () => new InvestigationFiles(dependencies.files, { id: randomUUID, now: () => new Date().toISOString(), hash: bytes => createHash('sha256').update(bytes).digest('hex') }) },
    { provide: AI_FLOW, useFactory: () => new AiFlowGenerator(new DocumentTextExtractor(), new HuggingFaceFlowModel({ token: dependencies.ai?.token, model: dependencies.ai?.model ?? 'Qwen/Qwen2.5-7B-Instruct' })) },
  ] })
  class ApiModule {}
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, { logger: false, bodyParser: false });
  if (dependencies.accessToken) {
    const requireToken = (request: { headers: { authorization?: string } }, response: { status(code: number): { json(body: unknown): void } }, next: () => void) => {
      if (!isAuthorized(request.headers.authorization, dependencies.accessToken!)) return response.status(401).json({ statusCode: 401, message: 'Acceso no autorizado' });
      next();
    };
    app.use('/api/investigations', requireToken);
    app.use('/api/ai', requireToken);
  }
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('raw', { type: 'application/octet-stream', limit: '10mb' });
  app.setGlobalPrefix('api'); app.useGlobalFilters(new InvestigationErrorFilter(), new AiErrorFilter());
  app.enableCors({ origin: dependencies.allowedOrigins ?? ['http://127.0.0.1:3000', 'http://localhost:3000'], methods: ['GET', 'POST', 'PUT'], credentials: false });
  return app;
}
