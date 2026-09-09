import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Operator } from '../entities/operator.entity';
import { Session } from '../entities/session.entity';

function repoMock() {
  return {
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve(v)),
    create: jest.fn((v: unknown) => v),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

/** ADR 0017: validateSession이 findOne(relations) 대신 단일 JOIN 쿼리(getOne)를 쓰는지 검증하기 위한 체이닝 mock. */
function queryBuilderMock(result: unknown) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  };
}

describe('AuthService', () => {
  const TTL = 604800;
  let operators: ReturnType<typeof repoMock>;
  let sessions: ReturnType<typeof repoMock>;
  let service: AuthService;
  let operator: Operator;

  beforeEach(async () => {
    operators = repoMock();
    sessions = repoMock();
    operator = {
      id: 'op-1',
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('correct-password', 10),
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
    };
    service = new AuthService(operators as never, sessions as never, TTL);
  });

  describe('login', () => {
    it('올바른 비밀번호면 세션을 생성하고 expiresAt = now + ttl', async () => {
      operators.findOne.mockResolvedValue(operator);
      const before = Date.now();
      const result = await service.login('admin@example.com', 'correct-password');
      expect(result.operator).toBe(operator);
      expect(sessions.save).toHaveBeenCalled();
      const savedExpiresAt = (result.session.expiresAt as Date).getTime();
      expect(savedExpiresAt).toBeGreaterThanOrEqual(before + TTL * 1000);
      expect(savedExpiresAt).toBeLessThanOrEqual(Date.now() + TTL * 1000 + 1000);
    });

    it('틀린 비밀번호면 UnauthorizedException', async () => {
      operators.findOne.mockResolvedValue(operator);
      await expect(service.login('admin@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('존재하지 않는 이메일이면 UnauthorizedException', async () => {
      operators.findOne.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'x')).rejects.toThrow(UnauthorizedException);
    });

    it('ADR 0020: isActive=false인 운영자는 비밀번호가 맞아도 UnauthorizedException(사유 비노출)', async () => {
      operators.findOne.mockResolvedValue({ ...operator, isActive: false });
      await expect(service.login('admin@example.com', 'correct-password')).rejects.toThrow(UnauthorizedException);
      expect(sessions.save).not.toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    it('만료 세션은 null을 반환한다', async () => {
      sessions.createQueryBuilder.mockReturnValue(
        queryBuilderMock({
          id: 'sess-1',
          operatorId: 'op-1',
          operator,
          expiresAt: new Date(Date.now() - 1000),
          createdAt: new Date(),
        }),
      );
      const result = await service.validateSession('sess-1');
      expect(result).toBeNull();
      expect(sessions.delete).toHaveBeenCalledWith('sess-1');
    });

    it('유효한 세션이면 operator를 반환한다', async () => {
      sessions.createQueryBuilder.mockReturnValue(
        queryBuilderMock({
          id: 'sess-1',
          operatorId: 'op-1',
          operator,
          expiresAt: new Date(Date.now() + 1000),
          createdAt: new Date(),
        }),
      );
      const result = await service.validateSession('sess-1');
      expect(result).toBe(operator);
    });

    it('세션이 없으면 null을 반환한다', async () => {
      sessions.createQueryBuilder.mockReturnValue(queryBuilderMock(null));
      const result = await service.validateSession('missing');
      expect(result).toBeNull();
    });

    it('ADR 0020: isActive=false인 운영자의 세션은 삭제하고 null을 반환한다', async () => {
      sessions.createQueryBuilder.mockReturnValue(
        queryBuilderMock({
          id: 'sess-1',
          operatorId: 'op-1',
          operator: { ...operator, isActive: false },
          expiresAt: new Date(Date.now() + 1000),
          createdAt: new Date(),
        }),
      );
      const result = await service.validateSession('sess-1');
      expect(result).toBeNull();
      expect(sessions.delete).toHaveBeenCalledWith('sess-1');
    });

    it('ADR 0017: findOne(relations) 대신 leftJoinAndSelect + getOne으로 단일 쿼리에 operator를 조인한다', async () => {
      const qb = queryBuilderMock({
        id: 'sess-1',
        operatorId: 'op-1',
        operator,
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      sessions.createQueryBuilder.mockReturnValue(qb);
      await service.validateSession('sess-1');
      expect(sessions.createQueryBuilder).toHaveBeenCalled();
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('session.operator', 'operator');
      expect(sessions.findOne).not.toHaveBeenCalled();
    });
  });
});
