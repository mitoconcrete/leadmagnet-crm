import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PublicPageController } from './public-page.controller';
import { PublicService } from './public.service';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { VISITOR_COOKIE } from '../common/cookies';

describe('PublicPageController (vid 쿠키 갱신)', () => {
  let app: INestApplication;
  const publicService = { recordVisit: jest.fn() };

  const form = {
    id: 'form-1',
    slug: 'my-form',
    name: '테스트 폼',
    template: { html: '<form></form>' },
  };
  const visit = { id: 'visit-1' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicPageController],
      providers: [
        { provide: PublicService, useValue: publicService },
        { provide: PUBLIC_BASE_URL, useValue: 'http://localhost:3001' },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('vid 쿠키가 없으면 새 visitor id로 Set-Cookie를 내려준다', async () => {
    const visitor = { id: 'new-visitor-1' };
    publicService.recordVisit.mockResolvedValue({ form, visit, visitor });

    const res = await request(app.getHttpServer()).get('/p/my-form');

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith(`${VISITOR_COOKIE}=${visitor.id}`))).toBe(true);
  });

  it('기존 vid 쿠키가 DB에 없어 새 visitor가 생성됐으면 새 id로 Set-Cookie를 갱신한다', async () => {
    const staleVisitorId = '22222222-2222-2222-2222-222222222222';
    const newVisitor = { id: '33333333-3333-3333-3333-333333333333' };
    publicService.recordVisit.mockResolvedValue({ form, visit, visitor: newVisitor });

    const res = await request(app.getHttpServer())
      .get('/p/my-form')
      .set('Cookie', `${VISITOR_COOKIE}=${staleVisitorId}`);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith(`${VISITOR_COOKIE}=${newVisitor.id}`))).toBe(true);
  });

  it('기존 vid 쿠키가 그대로 유효하면 Set-Cookie를 다시 내려주지 않는다', async () => {
    const existingVisitorId = '44444444-4444-4444-4444-444444444444';
    publicService.recordVisit.mockResolvedValue({ form, visit, visitor: { id: existingVisitorId } });

    const res = await request(app.getHttpServer())
      .get('/p/my-form')
      .set('Cookie', `${VISITOR_COOKIE}=${existingVisitorId}`);

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('vid 쿠키가 uuid 형식이 아니면 새 visitor로 취급해 recordVisit에 undefined를 넘기고 Set-Cookie를 갱신한다', async () => {
    const newVisitor = { id: '55555555-5555-5555-5555-555555555555' };
    publicService.recordVisit.mockResolvedValue({ form, visit, visitor: newVisitor });

    const res = await request(app.getHttpServer())
      .get('/p/my-form')
      .set('Cookie', `${VISITOR_COOKIE}=not-a-uuid`);

    expect(res.status).toBe(200);
    expect(publicService.recordVisit).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: undefined }),
    );
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.some((c) => c.startsWith(`${VISITOR_COOKIE}=${newVisitor.id}`))).toBe(true);
  });
});
