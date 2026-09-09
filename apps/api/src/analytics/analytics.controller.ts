import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('channels')
  channels() {
    return this.analyticsService.channelStats();
  }

  @Get('campaigns')
  campaigns() {
    return this.analyticsService.campaignList();
  }
}
