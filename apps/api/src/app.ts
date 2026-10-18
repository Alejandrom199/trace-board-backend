import 'reflect-metadata';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID, createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { Investigations, PostgresInvestigationsRepository, INVESTIGATIONS, InvestigationsController, InvestigationErrorFilter, InvestigationFiles, PostgresFilesRepository, FILES, FilesController } from './features/investigations/index.js';

export async function createApi(pool: Pool): Promise<INestApplication> {
  @Module({ controllers: [InvestigationsController, FilesController], providers: [
    { provide: INVESTIGATIONS, useFactory: () => new Investigations(new PostgresInvestigationsRepository(pool), { id: randomUUID, now: () => new Date().toISOString() }) },
    { provide: FILES, useFactory: () => new InvestigationFiles(new PostgresFilesRepository(pool), { id: randomUUID, now: () => new Date().toISOString(), hash: bytes => createHash('sha256').update(bytes).digest('hex') }) },
  ] })
  class ApiModule {}
  const app = await NestFactory.create<NestExpressApplication>(ApiModule, { logger: false, bodyParser: false });
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('raw', { type: 'application/octet-stream', limit: '10mb' });
  app.setGlobalPrefix('api'); app.useGlobalFilters(new InvestigationErrorFilter());
  app.enableCors({ origin: ['http://127.0.0.1:3000', 'http://localhost:3000'], methods: ['GET', 'POST', 'PUT'], credentials: false });
  return app;
}
