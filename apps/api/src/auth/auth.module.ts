import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from '../entities/operator.entity';
import { Session } from '../entities/session.entity';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { loadEnv } from '../config/env';
import { isDocsOnly, stubRepositoryProviders } from '../common/docs-only';

@Module({
  imports: [...(isDocsOnly() ? [] : [TypeOrmModule.forFeature([Operator, Session])])],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    { provide: SESSION_TTL_SECONDS, useFactory: () => loadEnv().sessionTtlSeconds },
    ...(isDocsOnly() ? stubRepositoryProviders([Operator, Session]) : []),
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
