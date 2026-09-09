import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Multer 크기 초과 오류(Nest의 FileInterceptor가 LIMIT_FILE_SIZE를 PayloadTooLargeException으로
 * 변환한다)만 400 + 안내 메시지로 바꾼다. 그 외 예외는 이 필터에 도달하지 않고 Nest의 기본
 * 예외 처리로 넘어간다.
 */
@Catch(PayloadTooLargeException)
export class MulterExceptionFilter implements ExceptionFilter<PayloadTooLargeException> {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(400).json({
      statusCode: 400,
      message: '파일 크기는 512KB 이하여야 합니다',
      error: 'Bad Request',
    });
  }
}
