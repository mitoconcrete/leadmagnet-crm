import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { toLinkResponse } from '../links/link-response';
import { PUBLIC_BASE_URL } from '../common/tokens';

@ApiTags('forms')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
  ) {}

  @Post()
  async create(@Body() dto: CreateFormDto) {
    const form = await this.formsService.create(dto);
    return this.formsService.toResponse(form);
  }

  @Get()
  async findAll(@Query('campaignId') campaignId?: string) {
    const forms = await this.formsService.findAll(campaignId);
    return forms.map((form) => this.formsService.toResponse(form));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const form = await this.formsService.findOneWithLinks(id);
    return {
      ...this.formsService.toResponse(form),
      links: (form.links ?? []).map((link) => toLinkResponse(link, form, this.publicBaseUrl)),
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    const form = await this.formsService.update(id, dto);
    return this.formsService.toResponse(form);
  }
}
