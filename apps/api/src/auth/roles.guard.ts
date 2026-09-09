import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithOperator } from './auth.guard';

/**
 * ADR 0020(부분 채택): 준비만 한다. @Roles가 없는 핸들러는 그대로 통과시키고,
 * @Roles가 있으면 req.operator.role이 목록에 있어야 한다. 이번 제출에는
 * 어떤 컨트롤러에도 적용하지 않는다(운영자 관리 API는 다음 단계).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[] | undefined>(ROLES_KEY, context.getHandler());
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithOperator>();
    const role = req.operator?.role;
    if (!role || !roles.includes(role)) {
      throw new ForbiddenException('권한이 없습니다');
    }
    return true;
  }
}
