import { BadRequestException } from '@nestjs/common';

export const MAX_HTML_BYTES = 524288;

export interface UploadedHtmlFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export function validateHtmlUpload(file: UploadedHtmlFile): void {
  if (!/\.html$/i.test(file.originalname)) {
    throw new BadRequestException('.html 파일만 등록할 수 있습니다');
  }
  if (file.size > MAX_HTML_BYTES) {
    throw new BadRequestException('파일 크기는 512KB 이하여야 합니다');
  }
  if (!/<form/i.test(file.buffer.toString('utf-8'))) {
    throw new BadRequestException('HTML에 <form> 태그가 필요합니다');
  }
}
