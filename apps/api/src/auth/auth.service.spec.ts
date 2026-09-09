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
  });

  describe('validateSession', () => {
    it('만료 세션은 null을 반환한다', async () => {
      sessions.findOne.mockResolvedValue({
        id: 'sess-1',
        operatorId: 'op-1',
        operator,
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });
      const result = await service.validateSession('sess-1');
      expect(result).toBeNull();
      expect(sessions.delete).toHaveBeenCalledWith('sess-1');
    });

    it('유효한 세션이면 operator를 반환한다', async () => {
      sessions.findOne.mockResolvedValue({
        id: 'sess-1',
        operatorId: 'op-1',
        operator,
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      const result = await service.validateSession('sess-1');
      expect(result).toBe(operator);
    });

    it('세션이 없으면 null을 반환한다', async () => {
      sessions.findOne.mockResolvedValue(null);
      const result = await service.validateSession('missing');
      expect(result).toBeNull();
    });
  });
});
