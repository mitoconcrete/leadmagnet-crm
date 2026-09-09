import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { TemplatesService } from './templates.service';
import { MAX_HTML_BYTES } from './html-validation';
import { toDetail, toListItem } from './dto/template-response.dto';
import { MulterExceptionFilter } from './multer-exception.filter';

@ApiTags('templates')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_HTML_BYTES } }))
  @ApiConsumes('multipart/form-data')
  async create(@UploadedFile() file: Express.Multer.File, @Body('name') name?: string) {
    if (!file) throw new BadRequestException('.html 파일만 등록할 수 있습니다');
    const created = await this.templatesService.create(
      { originalname: file.originalname, size: file.size, buffer: file.buffer },
      name,
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
}
