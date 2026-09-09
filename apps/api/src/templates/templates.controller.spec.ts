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

describe('TemplatesController (POST / 붙여넣기 등록 html 필드)', () => {
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

  it('html과 name만 보내면 {name}.html 파일명으로 서비스를 호출한다', async () => {
    templatesService.create.mockResolvedValue({
      id: 't1',
      name: '붙여넣기',
      originalFilename: '붙여넣기.html',
      sizeBytes: 13,
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/templates')
      .field('html', '<form></form>')
      .field('name', '붙여넣기');

    expect(res.status).toBe(201);
    expect(templatesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: '붙여넣기.html',
        buffer: Buffer.from('<form></form>', 'utf-8'),
        size: Buffer.byteLength('<form></form>', 'utf-8'),
      }),
      '붙여넣기',
    );
  });

  it('html만 있고 name이 없으면 400을 반환한다', async () => {
    const res = await request(app.getHttpServer()).post('/api/admin/templates').field('html', '<form></form>');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('붙여넣기 등록에는 이름이 필요합니다');
    expect(templatesService.create).not.toHaveBeenCalled();
  });

  it('file과 html이 함께 오면 400을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/templates')
      .field('html', '<form></form>')
      .field('name', '이름')
      .attach('file', Buffer.from('<form></form>'), 'orig.html');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('file과 html은 함께 보낼 수 없습니다');
    expect(templatesService.create).not.toHaveBeenCalled();
  });

  it('file도 html도 없으면 400을 반환한다', async () => {
    const res = await request(app.getHttpServer()).post('/api/admin/templates').field('name', '이름');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('file 또는 html 중 하나가 필요합니다');
    expect(templatesService.create).not.toHaveBeenCalled();
  });

  it('html이 문자열이 아니면(중복 필드) 400을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/templates')
      .field('html', '<form></form>')
      .field('html', '<form>두번째</form>')
      .field('name', '이름');

    expect(res.status).toBe(400);
    expect(templatesService.create).not.toHaveBeenCalled();
  });
});

describe('TemplatesController (DELETE /:id)', () => {
  let app: INestApplication;
  const templatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const templateId = '22222222-2222-2222-2222-222222222222';

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

  it('force 쿼리가 없으면 force=false로 서비스를 호출하고 204를 반환한다', async () => {
    templatesService.remove.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).delete(`/api/admin/templates/${templateId}`);

    expect(res.status).toBe(204);
    expect(templatesService.remove).toHaveBeenCalledWith(templateId, false);
  });

  it('force=true일 때만 force를 참으로 전달한다', async () => {
    templatesService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete(`/api/admin/templates/${templateId}?force=true`);
    expect(templatesService.remove).toHaveBeenLastCalledWith(templateId, true);

    await request(app.getHttpServer()).delete(`/api/admin/templates/${templateId}?force=1`);
    expect(templatesService.remove).toHaveBeenLastCalledWith(templateId, false);
  });

  it('서비스가 던진 예외 상태 코드를 그대로 응답한다', async () => {
    templatesService.remove.mockRejectedValue(new NotFoundException('템플릿을 찾을 수 없습니다'));

    const res = await request(app.getHttpServer()).delete(`/api/admin/templates/${templateId}`);

    expect(res.status).toBe(404);
  });

  it('uuid 형식이 아닌 id는 400이다', async () => {
    const res = await request(app.getHttpServer()).delete('/api/admin/templates/not-a-uuid');
    expect(res.status).toBe(400);
    expect(templatesService.remove).not.toHaveBeenCalled();
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
