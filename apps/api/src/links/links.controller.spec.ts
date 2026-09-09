import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { FormsService } from '../forms/forms.service';
import { AuthGuard } from '../auth/auth.guard';

describe('LinksController (uuid 경로 검증)', () => {
  let app: INestApplication;
  const linksService = { create: jest.fn(), findByForm: jest.fn(), toResponse: jest.fn() };
  const formsService = { findOne: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        { provide: LinksService, useValue: linksService },
        { provide: FormsService, useValue: formsService },
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

  it('POST의 형식이 잘못된 formId는 400이고 서비스가 호출되지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/forms/not-a-uuid/links')
      .send({ channel: 'instagram' });
    expect(res.status).toBe(400);
    expect(linksService.create).not.toHaveBeenCalled();
  });

  it('GET의 형식이 잘못된 formId는 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/forms/not-a-uuid/links');
    expect(res.status).toBe(400);
    expect(formsService.findOne).not.toHaveBeenCalled();
  });

  it('형식은 맞지만 존재하지 않는 formId는 404', async () => {
    formsService.findOne.mockRejectedValue(new NotFoundException('폼을 찾을 수 없습니다'));
    const res = await request(app.getHttpServer()).get(
      '/api/admin/forms/11111111-1111-4111-8111-111111111111/links',
    );
    expect(res.status).toBe(404);
  });
});
