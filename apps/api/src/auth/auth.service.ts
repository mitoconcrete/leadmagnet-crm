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
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000);
    const session = await this.sessions.save(
      this.sessions.create({ operatorId: operator.id, expiresAt }),
    );
    return { session, operator };
  }

  async validateSession(id: string): Promise<Operator | null> {
    const session = await this.sessions.findOne({ where: { id }, relations: ['operator'] });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.delete(session.id);
      return null;
    }
    return session.operator;
  }

  async logout(id: string): Promise<void> {
    await this.sessions.delete(id);
  }
}
