import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HtmlTemplate } from '../entities/html-template.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([HtmlTemplate]), AuthModule],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
