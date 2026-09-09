import { Controller, Get, ParseIntPipe, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@ApiCookieAuth('sid')
@UseGuards(AuthGuard)
@Controller('api/admin/submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  list(
    @Query('campaignId', new ParseUUIDPipe({ optional: true })) campaignId?: string,
    @Query('formId', new ParseUUIDPipe({ optional: true })) formId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.submissionsService.list({
      campaignId,
      formId,
      page,
      limit,
    });
  }
}
