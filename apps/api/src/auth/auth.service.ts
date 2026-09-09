import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { Session } from '../entities/session.entity';

export const SESSION_TTL_SECONDS = 'SESSION_TTL_SECONDS';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Operator) private readonly operators: Repository<Operator>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @Inject(SESSION_TTL_SECONDS) private readonly sessionTtlSeconds: number,
  ) {}

  async login(email: string, password: string): Promise<{ session: Session; operator: Operator }> {
    const operator = await this.operators.findOne({ where: { email } });
    if (!operator) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    const matches = await bcrypt.compare(password, operator.passwordHash);
    if (!matches) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    // ADR 0020: 정지된(isActive=false) 운영자는 비밀번호가 맞아도 401. 사유는 노출하지 않는다.
    if (!operator.isActive) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000);
    const session = await this.sessions.save(
      this.sessions.create({ operatorId: operator.id, expiresAt }),
    );
    return { session, operator };
  }

  /**
   * ADR 0017: findOne({relations})은 take:1+JOIN 조합에서 id 조회 1개 + 본문 조회 1개로
   * 나뉘어(TypeORM의 페이지네이션 안전 전략) 매 요청마다 쿼리가 2개 나간다. QueryBuilder로
   * 직접 leftJoinAndSelect+getOne을 쓰면 단일 쿼리로 끝난다.
   */
  async validateSession(id: string): Promise<Operator | null> {
    const session = await this.sessions
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.operator', 'operator')
      .where('session.id = :id', { id })
      .getOne();
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.delete(session.id);
      return null;
    }
    // ADR 0020: 로그인 이후 정지된 운영자는 세션이 남아 있어도 즉시 무효화한다.
    if (!session.operator.isActive) {
      await this.sessions.delete(session.id);
      return null;
    }
    return session.operator;
  }

  async logout(id: string): Promise<void> {
    await this.sessions.delete(id);
  }
}
