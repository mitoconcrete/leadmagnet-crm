import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { FormsService } from '../forms/forms.service';

@ApiTags('links')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/forms/:formId/links')
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly formsService: FormsService,
  ) {}

  @Post()
  async create(@Param('formId') formId: string, @Body() dto: CreateLinkDto) {
    const link = await this.linksService.create(formId, dto.channel);
    const form = await this.formsService.findOne(formId);
    return this.linksService.toResponse(link, form);
  }

  @Get()
  async findAll(@Param('formId') formId: string) {
    const form = await this.formsService.findOne(formId);
    const links = await this.linksService.findByForm(formId);
    return links.map((link) => this.linksService.toResponse(link, form));
  }
}
