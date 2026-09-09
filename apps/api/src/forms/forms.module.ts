import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Form } from '../entities/form.entity';
import { Campaign } from '../entities/campaign.entity';
import { HtmlTemplate } from '../entities/html-template.entity';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { AuthModule } from '../auth/auth.module';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { loadEnv } from '../config/env';

@Module({
  imports: [TypeOrmModule.forFeature([Form, Campaign, HtmlTemplate]), AuthModule],
  providers: [FormsService, { provide: PUBLIC_BASE_URL, useFactory: () => loadEnv().publicBaseUrl }],
  controllers: [FormsController],
  exports: [FormsService],
})
export class FormsModule {}
