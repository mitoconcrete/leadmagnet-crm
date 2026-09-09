import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * ADR 0020(부분 채택): 구조만 준비한다. 이번 제출에는 어떤 컨트롤러·핸들러에도
 * 적용하지 않는다(운영자 관리 API는 다음 단계).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
