import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { InvalidDocumentError, AiGenerationError, AiUpstreamError, AiNotConfiguredError } from '../domain/flow-generation.js';

@Catch(InvalidDocumentError, AiGenerationError, AiUpstreamError, AiNotConfiguredError)
export class AiErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const status = exception instanceof InvalidDocumentError ? 400 : exception instanceof AiNotConfiguredError ? 503 : 502;
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
