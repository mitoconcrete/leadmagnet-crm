import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { TemplatesService } from './templates.service';
import { MAX_HTML_BYTES } from './html-validation';
import { toDetail, toListItem } from './dto/template-response.dto';
import { MulterExceptionFilter } from './multer-exception.filter';
import { buildCsp, buildWrapperPage } from '../public/wrapper';
import { PUBLIC_BASE_URL } from '../common/tokens';

@ApiTags('templates')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
  ) {}

  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_HTML_BYTES } }))
  @ApiConsumes('multipart/form-data')
  async create(@UploadedFile() file: Express.Multer.File, @Body('name') name?: unknown) {
    if (!file) throw new BadRequestException('.html 파일만 등록할 수 있습니다');
    const created = await this.templatesService.create(
      { originalname: file.originalname, size: file.size, buffer: file.buffer },
      typeof name === 'string' ? name : undefined,
    );
    return toListItem(created);
  }

  @Get()
  async findAll() {
    const templates = await this.templatesService.findAll();
    return templates.map(toListItem);
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const template = await this.templatesService.findOne(id);
    return toDetail(template);
  }

  @Get(':id/preview')
  @ApiProduces('text/html')
  @ApiOkResponse({
    description:
      '템플릿 원본 HTML을 sandbox iframe으로 감싼 미리보기 페이지. 방문·방문자·쿠키를 기록/설정하지 않는다.',
  })
  async preview(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response): Promise<void> {
    const template = await this.templatesService.findOne(id);
    const html = buildWrapperPage({ title: template.name, srcdoc: template.html });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', buildCsp(this.publicBaseUrl));
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  }
}
