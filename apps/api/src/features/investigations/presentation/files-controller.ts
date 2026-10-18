import { Body, Controller, Get, Headers, Inject, Param, Post, Query, Res, StreamableFile, BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { fileDtoSchema } from '@traceboard/contracts';
import { z } from 'zod';
import type { InvestigationFiles } from '../application/files.js';
export const FILES = 'TRACEBOARD_FILES';
function validateIds(...ids: string[]) { if (ids.some(id => !z.uuid().safeParse(id).success)) throw new BadRequestException('Identificador de archivo o investigación inválido'); }
@Controller('investigations/:id/files')
export class FilesController {
  constructor(@Inject(FILES) private readonly files: InvestigationFiles) {}
  @Post()
  async upload(@Param('id') id: string, @Body() body: unknown, @Headers('content-type') type?: string, @Headers('x-file-name') encodedName?: string, @Headers('x-file-mime') mime?: string) {
    validateIds(id);
    if (!/^application\/octet-stream(?:\s*;|$)/i.test(type ?? '')) throw new UnsupportedMediaTypeException('Envía los bytes del archivo como application/octet-stream');
    if (!Buffer.isBuffer(body)) throw new BadRequestException('Archivo ilegible');
    let name: string;
    try { name = decodeURIComponent(encodedName ?? ''); } catch { throw new BadRequestException('Nombre de archivo inválido'); }
    return fileDtoSchema.parse(await this.files.upload(id, name, mime ?? '', body));
  }
  @Get(':fileId')
  async download(@Param('id') id: string, @Param('fileId') fileId: string, @Query('download') download: string | undefined, @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    validateIds(id, fileId);
    const file = await this.files.find(id, fileId);
    const encoded = encodeURIComponent(file.info.name).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    return new StreamableFile(Buffer.from(file.bytes), { type: file.info.mime, length: file.info.size, disposition: `${download === '1' ? 'attachment' : 'inline'}; filename="archivo"; filename*=UTF-8''${encoded}` });
  }
}
