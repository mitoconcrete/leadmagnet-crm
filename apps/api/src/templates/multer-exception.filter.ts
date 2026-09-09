import { ArgumentsHost, Catch, ExceptionFilter, HttpException, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';

function isMulterFileSizeError(exception: unknown): boolean {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    (exception as { code?: unknown }).code === 'LIMIT_FILE_SIZE'
  );
}

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof PayloadTooLargeException || isMulterFileSizeError(exception)) {
      response.status(400).json({
        statusCode: 400,
        message: '파일 크기는 512KB 이하여야 합니다',
        error: 'Bad Request',
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    throw exception;
  }
}
