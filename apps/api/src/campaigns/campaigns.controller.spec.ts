import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthGuard } from '../auth/auth.guard';

describe('CampaignsController (uuid 경로 검증)', () => {
  let app: INestApplication;
  const campaignsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOneWithForms: jest.fn(),
    update: jest.fn(),
  };
  const analyticsService = { campaignStats: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        { provide: CampaignsService, useValue: campaignsService },
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('형식이 잘못된 id는 400이고 서비스가 호출되지 않는다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/campaigns/not-a-uuid');
    expect(res.status).toBe(400);
    expect(campaignsService.findOneWithForms).not.toHaveBeenCalled();
  });

  it('형식은 맞지만 존재하지 않는 id는 404', async () => {
    campaignsService.findOneWithForms.mockRejectedValue(new NotFoundException('캠페인을 찾을 수 없습니다'));
    const res = await request(app.getHttpServer()).get(
      '/api/admin/campaigns/11111111-1111-4111-8111-111111111111',
    );
    expect(res.status).toBe(404);
  });

  it('PATCH의 잘못된 id도 400이다', async () => {
    const res = await request(app.getHttpServer()).patch('/api/admin/campaigns/not-a-uuid').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(campaignsService.update).not.toHaveBeenCalled();
  });

  it('stats의 잘못된 id도 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/campaigns/not-a-uuid/stats');
    expect(res.status).toBe(400);
    expect(campaignsService.findOneWithForms).not.toHaveBeenCalled();
    expect(analyticsService.campaignStats).not.toHaveBeenCalled();
  });
});
