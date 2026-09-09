import { Body, Controller, Header, HttpCode, Options, Param, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicService } from './public.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@ApiTags('public')
@Controller('api/public/forms')
export class PublicApiController {
  constructor(private readonly publicService: PublicService) {}

  @Post(':slug/submissions')
  @Header('Access-Control-Allow-Origin', '*')
  async submit(@Param('slug') slug: string, @Body() dto: CreateSubmissionDto) {
    return this.publicService.submit(slug, dto);
  }

  @Options(':slug/submissions')
  @HttpCode(204)
  options(@Res({ passthrough: true }) res: Response): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
  }
}
