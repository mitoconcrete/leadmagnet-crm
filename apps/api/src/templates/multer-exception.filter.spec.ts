import {
  ArgumentsHost,
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  PayloadTooLargeException,
  UseFilters,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MulterExceptionFilter } from './multer-exception.filter';

function hostMock(res: { status: jest.Mock; json: jest.Mock }): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

function resMock() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('MulterExceptionFilter', () => {
  it('PayloadTooLargeException(413, Multer 크기 초과)은 400 + 512KB 메시지로 변환한다', () => {
    const filter = new MulterExceptionFilter();
    const res = resMock();
    filter.catch(new PayloadTooLargeException('File too large'), hostMock(res));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: '파일 크기는 512KB 이하여야 합니다',
      error: 'Bad Request',
    });
  });
});

@Controller('t')
class MulterFilterTestController {
  @Get('too-large')
  @UseFilters(MulterExceptionFilter)
  tooLarge(): never {
    throw new PayloadTooLargeException('File too large');
  }

  @Get('bad-request')
  @UseFilters(MulterExceptionFilter)
  badRequest(): never {
    throw new BadRequestException('.html 파일만 등록할 수 있습니다');
  }

  @Get('unexpected')
  @UseFilters(MulterExceptionFilter)
  unexpected(): never {
    throw new Error('예상치 못한 오류');
  }
}

describe('MulterExceptionFilter (@Catch 범위, 다른 예외는 필터에 도달하지 않는다)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MulterFilterTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('PayloadTooLargeException은 필터가 처리해 400 + 512KB 메시지를 반환한다', async () => {
    const res = await request(app.getHttpServer()).get('/t/too-large');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: '파일 크기는 512KB 이하여야 합니다',
      error: 'Bad Request',
    });
  });

  it('PayloadTooLargeException이 아닌 HttpException은 필터를 거치지 않고 Nest 기본 처리로 원래 상태·본문 그대로 응답한다', async () => {
    const res = await request(app.getHttpServer()).get('/t/bad-request');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('.html 파일만 등록할 수 있습니다');
  });

  it('HTTP 예외가 아닌 오류는 필터를 거치지 않고 Nest 기본 500 JSON으로 응답한다(Express 기본 HTML이 아니다)', async () => {
    const res = await request(app.getHttpServer()).get('/t/unexpected');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error' });
  });
});
