import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TemplatesService } from './templates.service';
import { validateHtmlUpload, MAX_HTML_BYTES } from './html-validation';
import { HtmlTemplate } from '../entities/html-template.entity';
import { Form } from '../entities/form.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'tpl-1', createdAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
    delete: jest.fn(),
  };
}

function dataSourceMock() {
  return {
    query: jest.fn(),
    transaction: jest.fn(),
  };
}

const validFile = { originalname: 'landing.html', size: 100, buffer: Buffer.from('<html><form></form></html>') };

describe('validateHtmlUpload', () => {
  it('정상 HTML 파일은 통과한다', () => {
    expect(() => validateHtmlUpload(validFile)).not.toThrow();
  });

  it('.html이 아니면 400', () => {
    expect(() => validateHtmlUpload({ ...validFile, originalname: 'landing.txt' })).toThrow(BadRequestException);
    try {
      validateHtmlUpload({ ...validFile, originalname: 'landing.txt' });
    } catch (e) {
      expect((e as BadRequestException).message).toBe('.html 파일만 등록할 수 있습니다');
    }
  });

  it('512KB 초과면 400', () => {
    expect(() => validateHtmlUpload({ ...validFile, size: MAX_HTML_BYTES + 1 })).toThrow(BadRequestException);
    try {
      validateHtmlUpload({ ...validFile, size: MAX_HTML_BYTES + 1 });
    } catch (e) {
      expect((e as BadRequestException).message).toBe('파일 크기는 512KB 이하여야 합니다');
    }
  });

  it('<form> 태그가 없으면 400', () => {
    const noForm = { ...validFile, buffer: Buffer.from('<html><body>hi</body></html>') };
    expect(() => validateHtmlUpload(noForm)).toThrow(BadRequestException);
    try {
      validateHtmlUpload(noForm);
    } catch (e) {
      expect((e as BadRequestException).message).toBe('HTML에 <form> 태그가 필요합니다');
    }
  });

  it('<FORM> 대문자도 통과한다', () => {
    const upperForm = { ...validFile, buffer: Buffer.from('<html><FORM></FORM></html>') };
    expect(() => validateHtmlUpload(upperForm)).not.toThrow();
  });
});

describe('TemplatesService', () => {
  let repo: ReturnType<typeof repoMock>;
  let dataSource: ReturnType<typeof dataSourceMock>;
  let service: TemplatesService;

  beforeEach(() => {
    repo = repoMock();
    dataSource = dataSourceMock();
    service = new TemplatesService(repo as never, dataSource as never);
  });

  it('name 미지정 시 originalname에서 .html을 제거해 name으로 사용한다', async () => {
    const result = await service.create(validFile);
    expect(result.name).toBe('landing');
  });

  it('name 지정 시 그대로 사용한다', async () => {
    const result = await service.create(validFile, '커스텀 이름');
    expect(result.name).toBe('커스텀 이름');
  });

  it('저장된 템플릿은 html, sizeBytes, originalFilename을 포함한다', async () => {
    const result = await service.create(validFile);
    expect(result.originalFilename).toBe('landing.html');
    expect(result.sizeBytes).toBe(validFile.size);
    expect(result.html).toBe(validFile.buffer.toString('utf-8'));
  });

  it('잘못된 파일이면 저장하지 않고 예외를 던진다', async () => {
    await expect(service.create({ ...validFile, originalname: 'bad.txt' })).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('저장 후 등록 점검 경고(ADR 0018)를 계산해 함께 반환하지만 저장 자체는 그대로 성공한다', async () => {
    const withViolations = {
      ...validFile,
      buffer: Buffer.from('<form><input type="text"><button type="button">보내기</button></form>'),
    };

    const result = await service.create(withViolations);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name 속성이 없는 입력 요소가 1개'),
        '제출 버튼(type="submit")이 없습니다',
      ]),
    );
  });

  it('점검 규칙을 모두 만족하는 html은 warnings가 빈 배열이다', async () => {
    const clean = {
      ...validFile,
      buffer: Buffer.from(
        '<form><input name="email"><input type="checkbox" name="consent"><button type="submit">보내기</button></form>',
      ),
    };

    const result = await service.create(clean);

    expect(result.warnings).toEqual([]);
  });

  it('findAll은 저장소의 목록을 그대로 반환한다', async () => {
    const list: HtmlTemplate[] = [];
    repo.find.mockResolvedValue(list);
    expect(await service.findAll()).toBe(list);
  });

  it('findOne은 없으면 404', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('findOne은 있으면 반환한다', async () => {
    const tpl = { id: 't1' } as HtmlTemplate;
    repo.findOne.mockResolvedValue(tpl);
    expect(await service.findOne('t1')).toBe(tpl);
  });

  it('findAll은 소프트 삭제된(deletedAt 있는) 템플릿을 제외하는 조건으로 조회한다', async () => {
    repo.find.mockResolvedValue([]);
    await service.findAll();
    const args = repo.find.mock.calls[0][0];
    expect(args.where.deletedAt).toEqual(IsNull());
  });

  it('findOne은 소프트 삭제된 템플릿이면 404를 던진다(deletedAt 조건으로 조회해 못 찾음)', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('deleted-id')).rejects.toThrow(NotFoundException);
    const args = repo.findOne.mock.calls[0][0];
    expect(args.where.deletedAt).toEqual(IsNull());
  });
});

describe('TemplatesService.create 이름 고유(ADR 0014)', () => {
  let repo: ReturnType<typeof repoMock>;
  let dataSource: ReturnType<typeof dataSourceMock>;
  let service: TemplatesService;

  beforeEach(() => {
    repo = repoMock();
    dataSource = dataSourceMock();
    service = new TemplatesService(repo as never, dataSource as never);
  });

  it('같은 이름의 살아 있는 템플릿이 있으면 409를 던지고 저장하지 않는다', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing', name: '중복 이름', deletedAt: null });

    await expect(service.create(validFile, '중복 이름')).rejects.toThrow(ConflictException);
    await expect(service.create(validFile, '중복 이름')).rejects.toThrow('같은 이름의 템플릿이 있습니다');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('중복 검사는 살아 있는 템플릿만 대상으로 한다(deletedAt IS NULL 조건)', async () => {
    repo.findOne.mockResolvedValue(null);

    await service.create(validFile, '재사용 가능 이름');

    const args = repo.findOne.mock.calls[0][0];
    expect(args.where).toEqual({ name: '재사용 가능 이름', deletedAt: IsNull() });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('name 미지정 시 파일명 기반 기본 이름도 같은 규칙으로 중복이면 409다', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing', name: 'landing', deletedAt: null });

    await expect(service.create(validFile)).rejects.toThrow(ConflictException);
    const args = repo.findOne.mock.calls[0][0];
    expect(args.where.name).toBe('landing');
  });

  it('저장 시점에 UNIQUE 위반(23505)이 나면 409로 매핑한다(선조회 이후 경쟁 상태)', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' }));

    await expect(service.create(validFile, '경쟁 이름')).rejects.toThrow(ConflictException);
    await expect(service.create(validFile, '경쟁 이름')).rejects.toThrow('같은 이름의 템플릿이 있습니다');
  });

  it('UNIQUE 위반이 아닌 다른 저장 오류는 그대로 던진다(409로 뭉개지 않는다)', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockRejectedValue(new Error('커넥션 끊김'));

    await expect(service.create(validFile, '정상 이름')).rejects.toThrow('커넥션 끊김');
  });
});

describe('TemplatesService.remove (ADR 0014 삭제 규칙)', () => {
  let repo: ReturnType<typeof repoMock>;
  let dataSource: ReturnType<typeof dataSourceMock>;
  let service: TemplatesService;

  beforeEach(() => {
    repo = repoMock();
    dataSource = dataSourceMock();
    service = new TemplatesService(repo as never, dataSource as never);
  });

  it('없는(또는 이미 소프트 삭제된) id면 404를 던지고 참조를 조회하지 않는다', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.remove('missing', false)).rejects.toThrow(NotFoundException);
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('참조하는 폼이 0개면 hard delete하고 204(반환값 없음)로 끝낸다', async () => {
    repo.findOne.mockResolvedValue({ id: 't1' });
    dataSource.query.mockResolvedValue([{ forms: 0, visits: 0, submissions: 0 }]);

    await service.remove('t1', false);

    expect(repo.delete).toHaveBeenCalledWith('t1');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('ADR 0017 TOCTOU: 참조 폼이 0개로 집계됐어도 hard delete 실행 중 FK 위반(23503)이 나면 409로 매핑한다', async () => {
    repo.findOne.mockResolvedValue({ id: 't1' });
    dataSource.query.mockResolvedValue([{ forms: 0, visits: 0, submissions: 0 }]);
    repo.delete.mockRejectedValue(Object.assign(new Error('foreign key violation'), { code: '23503' }));

    await expect(service.remove('t1', false)).rejects.toThrow(ConflictException);
    await expect(service.remove('t1', false)).rejects.toThrow('사용 중인 템플릿입니다');
  });

  it('hard delete 중 FK 위반이 아닌 다른 오류는 그대로 던진다(409로 뭉개지 않는다)', async () => {
    repo.findOne.mockResolvedValue({ id: 't1' });
    dataSource.query.mockResolvedValue([{ forms: 0, visits: 0, submissions: 0 }]);
    repo.delete.mockRejectedValue(new Error('커넥션 끊김'));

    await expect(service.remove('t1', false)).rejects.toThrow('커넥션 끊김');
  });

  it('참조하는 폼이 있고 force가 아니면 409와 details를 던지고 아무것도 쓰지 않는다', async () => {
    repo.findOne.mockResolvedValue({ id: 't1' });
    dataSource.query.mockResolvedValue([{ forms: 2, visits: 5, submissions: 3 }]);

    try {
      await service.remove('t1', false);
      throw new Error('예외가 발생해야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const conflict = error as ConflictException;
      expect(conflict.getStatus()).toBe(409);
      expect(conflict.getResponse()).toEqual({
        statusCode: 409,
        message: '사용 중인 템플릿입니다(폼 2개, 방문 5건, 신청 3건)',
        error: 'Conflict',
        details: { forms: 2, visits: 5, submissions: 3 },
      });
    }
    expect(repo.delete).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('참조하는 폼이 있고 force면 같은 트랜잭션 manager로 템플릿 소프트 삭제와 폼 비활성화를 함께 수행한다', async () => {
    repo.findOne.mockResolvedValue({ id: 't1' });
    dataSource.query.mockResolvedValue([{ forms: 2, visits: 5, submissions: 3 }]);

    const manager = { update: jest.fn().mockResolvedValue(undefined) };
    dataSource.transaction.mockImplementation((cb: (m: unknown) => Promise<void>) => cb(manager));

    await service.remove('t1', true);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledTimes(2);
    expect(manager.update.mock.calls[0][0]).toBe(HtmlTemplate);
    expect(manager.update.mock.calls[0][1]).toBe('t1');
    expect(manager.update.mock.calls[0][2]).toMatchObject({ deletedAt: expect.any(Date) });
    expect(manager.update.mock.calls[1][0]).toBe(Form);
    expect(manager.update.mock.calls[1][1]).toEqual({ templateId: 't1' });
    expect(manager.update.mock.calls[1][2]).toEqual({ isActive: false });
    // 두 update 호출이 트랜잭션 콜백에 전달된 같은 manager 인스턴스에서 일어났는지 확인
    expect(manager.update.mock.instances[0]).toBe(manager);
    expect(manager.update.mock.instances[1]).toBe(manager);
  });
});
