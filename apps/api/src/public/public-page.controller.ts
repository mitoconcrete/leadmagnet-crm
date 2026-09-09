import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PublicService } from './public.service';
import { buildInjectedHtml } from './inject';
import { buildCsp, buildWrapperPage } from './wrapper';
import { VISITOR_COOKIE, visitorCookieOptions } from '../common/cookies';
import { PUBLIC_BASE_URL } from '../common/tokens';

@ApiTags('public')
@Controller('p')
export class PublicPageController {
  constructor(
    private readonly publicService: PublicService,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
  ) {}

  @Get(':slug')
  async page(
    @Param('slug') slug: string,
    @Query('src') src: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const existingVisitorId = req.cookies?.[VISITOR_COOKIE];
    const { form, visit, visitor } = await this.publicService.recordVisit({
      slug,
      src,
      visitorId: existingVisitorId,
      userAgent: req.headers['user-agent'],
    });

    if (!existingVisitorId || visitor.id !== existingVisitorId) {
      res.cookie(VISITOR_COOKIE, visitor.id, visitorCookieOptions());
    }

    const submitUrl = `${this.publicBaseUrl}/api/public/forms/${form.slug}/submissions`;
    const injected = buildInjectedHtml(form.template.html, { submitUrl, visitToken: visit.id });
    const html = buildWrapperPage({ title: form.name, srcdoc: injected });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', buildCsp(this.publicBaseUrl));
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  }
}
