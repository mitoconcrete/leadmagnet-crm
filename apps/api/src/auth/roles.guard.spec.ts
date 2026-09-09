import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

/** ADR 0020(부분 채택): RolesGuard·Roles 데코레이터는 준비만 하고 아직 어떤 컨트롤러에도 적용하지 않는다. */
class DummyController {
  noRoles() {}

  @Roles('admin')
  adminOnly() {}
}

function contextFor(handler: () => void, operatorRole?: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => DummyController,
    switchToHttp: () => ({
      getRequest: () => ({ operator: operatorRole ? { role: operatorRole } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  // 실제 Reflector(모킹 아님)로 @Roles 데코레이터가 붙은 더미 핸들러의 메타데이터를 읽는다.
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const controller = new DummyController();

  it('@Roles 메타데이터가 없는 핸들러는 통과한다', () => {
    expect(guard.canActivate(contextFor(controller.noRoles))).toBe(true);
  });

  it('운영자 role이 @Roles 목록에 있으면 통과한다', () => {
    expect(guard.canActivate(contextFor(controller.adminOnly, 'admin'))).toBe(true);
  });

  it('운영자 role이 @Roles 목록에 없으면 ForbiddenException', () => {
    expect(() => guard.canActivate(contextFor(controller.adminOnly, 'operator'))).toThrow(ForbiddenException);
  });
});
