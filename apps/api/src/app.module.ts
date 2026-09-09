import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database.module';

@Module({
  imports: [...(process.env.DOCS_ONLY === '1' ? [] : [DatabaseModule])],
  controllers: [HealthController],
})
export class AppModule {}
