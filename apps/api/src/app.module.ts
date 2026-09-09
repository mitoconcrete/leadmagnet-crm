import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database.module';
import { AuthModule } from './auth/auth.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [...(process.env.DOCS_ONLY === '1' ? [] : [DatabaseModule]), AuthModule, TemplatesModule],
  controllers: [HealthController],
})
export class AppModule {}
