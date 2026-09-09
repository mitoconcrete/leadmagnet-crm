import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { AuthGuard } from '../auth/auth.guard';

describe('SubmissionsController (uuid 쿼리 검증)', () => {
  let app: INestApplication;
  const submissionsService = { list: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [{ provide: SubmissionsService, useValue: submissionsService }],
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
    submissionsService.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  });

  it('campaignId 형식이 잘못되면 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions?campaignId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(submissionsService.list).not.toHaveBeenCalled();
  });

  it('formId 형식이 잘못되면 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions?formId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(submissionsService.list).not.toHaveBeenCalled();
  });

  it('둘 다 없으면 정상 동작한다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions');
    expect(res.status).toBe(200);
    expect(submissionsService.list).toHaveBeenCalled();
  });

  it('유효한 uuid는 그대로 전달된다', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const res = await request(app.getHttpServer()).get(`/api/admin/submissions?campaignId=${id}`);
    expect(res.status).toBe(200);
    expect(submissionsService.list).toHaveBeenCalledWith(expect.objectContaining({ campaignId: id }));
  });

  it('limit이 숫자가 아니면 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions?limit=abc');
    expect(res.status).toBe(400);
    expect(submissionsService.list).not.toHaveBeenCalled();
  });

  it('page가 숫자가 아니면 400이다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions?page=abc');
    expect(res.status).toBe(400);
    expect(submissionsService.list).not.toHaveBeenCalled();
  });

  it('page/limit을 지정하지 않으면 undefined가 전달된다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions');
    expect(res.status).toBe(200);
    expect(submissionsService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: undefined, limit: undefined }),
    );
  });

  it('정상 숫자 문자열은 숫자로 전달된다', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/submissions?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(submissionsService.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 10 }));
  });
});
