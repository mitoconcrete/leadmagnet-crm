import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { AuthGuard } from '../auth/auth.guard';
import { PUBLIC_BASE_URL } from '../common/tokens';

describe('FormsController (uuid 경로·쿼리 검증)', () => {
  let app: INestApplication;
  const formsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneWithLinks: jest.fn(),
    update: jest.fn(),
    toResponse: jest.fn((form: unknown) => form),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FormsController],
      providers: [
        { provide: FormsService, useValue: formsService },
        { provide: PUBLIC_BASE_URL, useValue: 'http://localhost:3001' },
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

  it('GET /:id의 잘못된 id는 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/forms/not-a-uuid');
    expect(res.status).toBe(400);
    expect(formsService.findOneWithLinks).not.toHaveBeenCalled();
  });

  it('GET /?campaignId= 형식이 잘못되면 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/forms?campaignId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(formsService.findAll).not.toHaveBeenCalled();
  });

  it('GET /?campaignId= 없이 호출하면 정상 동작한다', async () => {
    formsService.findAll.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get('/api/admin/forms');
    expect(res.status).toBe(200);
    expect(formsService.findAll).toHaveBeenCalledWith(undefined);
  });

  it('GET /?campaignId=유효한 uuid면 서비스에 전달된다', async () => {
    formsService.findAll.mockResolvedValue([]);
    const res = await request(app.getHttpServer()).get(
      '/api/admin/forms?campaignId=11111111-1111-4111-8111-111111111111',
    );
    expect(res.status).toBe(200);
    expect(formsService.findAll).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('PATCH /:id의 잘못된 id는 400이다', async () => {
    const res = await request(app.getHttpServer()).patch('/api/admin/forms/not-a-uuid').send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(formsService.update).not.toHaveBeenCalled();
  });

  it('형식은 맞지만 존재하지 않는 id는 404', async () => {
    formsService.findOneWithLinks.mockRejectedValue(new NotFoundException('폼을 찾을 수 없습니다'));
    const res = await request(app.getHttpServer()).get(
      '/api/admin/forms/11111111-1111-4111-8111-111111111111',
    );
    expect(res.status).toBe(404);
  });
});
