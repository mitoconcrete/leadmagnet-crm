import { ArgumentsHost, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
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

  it('code가 LIMIT_FILE_SIZE인 원시 Multer 오류도 400 + 512KB 메시지로 변환한다', () => {
    const filter = new MulterExceptionFilter();
    const res = resMock();
    const rawMulterError = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
    filter.catch(rawMulterError, hostMock(res));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '파일 크기는 512KB 이하여야 합니다' }),
    );
  });

  it('다른 HttpException(예: 확장자 검증 실패)은 원래 상태·본문 그대로 통과시킨다', () => {
    const filter = new MulterExceptionFilter();
    const res = resMock();
    const exception = new BadRequestException('.html 파일만 등록할 수 있습니다');
    filter.catch(exception, hostMock(res));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('HTTP 예외가 아니면 그대로 다시 던진다', () => {
    const filter = new MulterExceptionFilter();
    const res = resMock();
    const error = new Error('예상치 못한 오류');
    expect(() => filter.catch(error, hostMock(res))).toThrow(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
