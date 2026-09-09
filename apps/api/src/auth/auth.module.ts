import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from '../entities/operator.entity';
import { Session } from '../entities/session.entity';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { loadEnv } from '../config/env';

@Module({
  imports: [TypeOrmModule.forFeature([Operator, Session])],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    { provide: SESSION_TTL_SECONDS, useFactory: () => loadEnv().sessionTtlSeconds },
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
