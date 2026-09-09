import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { AuthGuard } from '../auth/auth.guard';
import { PUBLIC_BASE_URL } from '../common/tokens';

describe('TemplatesController (name 타입 방어)', () => {
  let app: INestApplication;
  const templatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: TemplatesService, useValue: templatesService },
        { provide: PUBLIC_BASE_URL, useValue: 'http://localhost:3001' },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('name 필드가 문자열이면 그대로 서비스에 전달한다', async () => {
    templatesService.create.mockResolvedValue({
      id: 't1',
      name: '사용자 지정 이름',
      originalFilename: 'orig.html',
      sizeBytes: 10,
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/templates')
      .field('name', '사용자 지정 이름')
      .attach('file', Buffer.from('<form></form>'), 'orig.html');

    expect(res.status).toBe(201);
    expect(templatesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'orig.html' }),
      '사용자 지정 이름',
    );
  });

  it('name 필드가 중복 전송되어 배열로 들어오면 undefined로 취급해 원본 파일명을 쓰게 한다', async () => {
    templatesService.create.mockResolvedValue({
      id: 't1',
      name: 'orig',
      originalFilename: 'orig.html',
      sizeBytes: 10,
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/templates')
      .field('name', '첫번째')
      .field('name', '두번째')
      .attach('file', Buffer.from('<form></form>'), 'orig.html');

    expect(res.status).toBe(201);
    expect(templatesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'orig.html' }),
      undefined,
    );
  });
});

describe('TemplatesController (GET /:id/preview)', () => {
  let app: INestApplication;
  const templatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  };
  const templateId = '11111111-1111-1111-1111-111111111111';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TemplatesController],
      providers: [
        { provide: TemplatesService, useValue: templatesService },
        { provide: PUBLIC_BASE_URL, useValue: 'http://localhost:3001' },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CSP·X-Frame-Options·Cache-Control 헤더와 sandbox 속성을 가진 본문을 반환하고 VISIT_TOKEN을 담지 않는다', async () => {
    templatesService.findOne.mockResolvedValue({
      id: templateId,
      name: '미리보기 템플릿',
      originalFilename: 'orig.html',
      html: '<form></form>',
      sizeBytes: 10,
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer()).get(`/api/admin/templates/${templateId}/preview`);

    expect(res.status).toBe(200);
    expect(templatesService.findOne).toHaveBeenCalledWith(templateId);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('sandbox="allow-scripts allow-forms"');
    expect(res.text).not.toContain('VISIT_TOKEN');
  });

  it('존재하지 않는 id면 404다', async () => {
    templatesService.findOne.mockRejectedValue(new NotFoundException('템플릿을 찾을 수 없습니다'));

    const res = await request(app.getHttpServer()).get(`/api/admin/templates/${templateId}/preview`);

    expect(res.status).toBe(404);
  });
});
