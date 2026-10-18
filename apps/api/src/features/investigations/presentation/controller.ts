import { Body, Controller, Get, Headers, Inject, Param, Post, Put, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { createInvestigationRequestSchema, investigationDtoSchema, investigationListSchema, boardDtoSchema, saveBoardRequestSchema } from '@traceboard/contracts';
import { z } from 'zod';
import type { Investigations } from '../application/investigations.js';
export const INVESTIGATIONS = 'TRACEBOARD_INVESTIGATIONS';
@Controller('investigations')
export class InvestigationsController {
  constructor(@Inject(INVESTIGATIONS) private readonly investigations: Investigations) {}
  @Post()
  async create(@Body() body: unknown, @Headers('content-type') contentType?: string) {
    if (!/^application\/json(?:\s*;|$)/i.test(contentType ?? '')) throw new UnsupportedMediaTypeException('Envía los datos como JSON');
    const parsed = createInvestigationRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Introduce un nombre de 1 a 120 caracteres y una descripción de hasta 2000');
    return investigationDtoSchema.parse(await this.investigations.create(parsed.data.name, parsed.data.description));
  }
  @Get()
  async list() { return investigationListSchema.parse(await this.investigations.list()); }
  @Get(':id')
  async find(@Param('id') id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Identificador de investigación inválido');
    return investigationDtoSchema.parse(await this.investigations.find(id));
  }
  @Get(':id/board')
  async board(@Param('id') id: string) {
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Identificador de investigación inválido');
    return boardDtoSchema.parse(await this.investigations.board(id));
  }
  @Put(':id/board')
  async saveBoard(@Param('id') id: string, @Body() body: unknown, @Headers('content-type') contentType?: string) {
    if (!/^application\/json(?:\s*;|$)/i.test(contentType ?? '')) throw new UnsupportedMediaTypeException('Envía los datos como JSON');
    if (!z.uuid().safeParse(id).success) throw new BadRequestException('Identificador de investigación inválido');
    const parsed = saveBoardRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('El contenido del tablero o la versión no son válidos');
    return boardDtoSchema.parse(await this.investigations.saveBoard(id, parsed.data.expectedRevision, parsed.data.content));
  }
}
