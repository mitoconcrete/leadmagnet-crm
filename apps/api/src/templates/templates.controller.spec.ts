import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { AuthGuard } from '../auth/auth.guard';

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
      providers: [{ provide: TemplatesService, useValue: templatesService }],
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
