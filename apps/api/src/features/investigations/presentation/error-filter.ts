import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { InvalidInvestigationError, InvestigationNotFoundError, RepositoryUnavailableError } from '../domain/investigation.js';
import { BoardConflictError } from '../domain/board.js';
import { FileNotFoundError } from '../domain/file.js';
@Catch(InvalidInvestigationError, InvestigationNotFoundError, RepositoryUnavailableError, BoardConflictError, FileNotFoundError)
export class InvestigationErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const status = exception instanceof BoardConflictError ? 409 : exception instanceof InvestigationNotFoundError || exception instanceof FileNotFoundError ? 404 : exception instanceof InvalidInvestigationError ? 400 : 503;
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
