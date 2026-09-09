import { Controller, Get, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.submissionsService.list({
      campaignId,
      formId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
