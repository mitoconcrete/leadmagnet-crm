import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AnalyticsService } from '../analytics/analytics.service';

@ApiTags('campaigns')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/campaigns')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.campaignsService.findOneWithForms(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Get(':id/stats')
  async stats(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.campaignsService.findOneWithForms(id);
    return this.analyticsService.campaignStats(id);
  }
}
