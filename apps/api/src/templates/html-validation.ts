import { BadRequestException } from '@nestjs/common';
import { findBlockedPatterns } from './html-lint';

export const MAX_HTML_BYTES = 524288;

export interface UploadedHtmlFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * 업로드·붙여넣기 공통 검증. 동작 요건(확장자, 크기, <form> 존재) 다음으로 ADR 0018
 * 차단 규칙(2026-09-10 개정, 스펙 §4.2 400)을 확인한다. 고신뢰 공격 패턴이 있으면
 * Nest ValidationPipe와 같은 형태({statusCode, message: string[], error})로 던진다.
 */
export function validateHtmlUpload(file: UploadedHtmlFile): void {
  if (!/\.html$/i.test(file.originalname)) {
    throw new BadRequestException('.html 파일만 등록할 수 있습니다');
  }
  if (file.size > MAX_HTML_BYTES) {
    throw new BadRequestException('파일 크기는 512KB 이하여야 합니다');
  }
  const html = file.buffer.toString('utf-8');
  if (!/<form/i.test(html)) {
    throw new BadRequestException('HTML에 <form> 태그가 필요합니다');
  }

  const blocked = findBlockedPatterns(html);
  if (blocked.length > 0) {
    throw new BadRequestException({ statusCode: 400, message: blocked, error: 'Bad Request' });
  }
}
