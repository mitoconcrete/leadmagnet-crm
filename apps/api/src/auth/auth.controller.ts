import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';
import { CurrentOperator } from './current-operator.decorator';
import { Operator } from '../entities/operator.entity';
import { SESSION_COOKIE, sessionCookieOptions } from '../common/cookies';

@ApiTags('auth')
@Controller('api/admin/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(SESSION_TTL_SECONDS) private readonly sessionTtlSeconds: number,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { session, operator } = await this.authService.login(dto.email, dto.password);
    res.cookie(SESSION_COOKIE, session.id, sessionCookieOptions(this.sessionTtlSeconds));
    return { operator: { id: operator.id, email: operator.email } };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiCookieAuth('sid')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) await this.authService.logout(sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/api/admin' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth('sid')
  me(@CurrentOperator() operator: Operator) {
    return { id: operator.id, email: operator.email };
  }
}
