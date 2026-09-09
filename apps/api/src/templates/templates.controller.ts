import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOkResponse, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { TemplatesService } from './templates.service';
import { MAX_HTML_BYTES } from './html-validation';
import type { UploadedHtmlFile } from './html-validation';
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '.html 파일. html 필드와 함께 보낼 수 없다' },
        html: {
          type: 'string',
          description:
            '붙여넣기 등록용 HTML 텍스트 전체. file 대신 사용하며, 이 필드를 쓸 때는 name이 필수다. 저장 파일명은 {name}.html이 된다',
        },
        name: { type: 'string', description: '템플릿 이름. html 필드 사용 시 필수' },
      },
    },
  })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: unknown,
    @Body('html') html?: unknown,
  ) {
    const resolvedName = typeof name === 'string' ? name : undefined;

    if (file && html !== undefined) {
      throw new BadRequestException('file과 html은 함께 보낼 수 없습니다');
    }
    if (!file && html === undefined) {
      throw new BadRequestException('file 또는 html 중 하나가 필요합니다');
    }

    let uploadFile: UploadedHtmlFile;
    if (file) {
      uploadFile = { originalname: file.originalname, size: file.size, buffer: file.buffer };
    } else {
      if (typeof html !== 'string') {
        throw new BadRequestException('html은 문자열이어야 합니다');
      }
      if (!resolvedName || resolvedName.trim().length === 0) {
        throw new BadRequestException('붙여넣기 등록에는 이름이 필요합니다');
      }
      const buffer = Buffer.from(html, 'utf-8');
      uploadFile = { originalname: `${resolvedName}.html`, size: buffer.byteLength, buffer };
    }

    const created = await this.templatesService.create(uploadFile, resolvedName);
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

  @Delete(':id')
  @HttpCode(204)
  @ApiQuery({
    name: 'force',
    required: false,
    description: "'true'일 때만 강제 삭제(소프트 삭제 + 참조 폼 비활성화)로 동작한다",
  })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @Query('force') force?: string): Promise<void> {
    await this.templatesService.remove(id, force === 'true');
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
