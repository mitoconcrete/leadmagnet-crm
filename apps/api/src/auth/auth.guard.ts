import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from '../common/cookies';

export interface RequestWithOperator extends Request {
  operator?: import('../entities/operator.entity').Operator;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithOperator>();
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (!sessionId) throw new UnauthorizedException('로그인이 필요합니다');
    const operator = await this.authService.validateSession(sessionId);
    if (!operator) throw new UnauthorizedException('로그인이 필요합니다');
    req.operator = operator;
    return true;
  }
}
