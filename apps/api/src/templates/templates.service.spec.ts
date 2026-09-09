import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { validateHtmlUpload, MAX_HTML_BYTES } from './html-validation';
import { HtmlTemplate } from '../entities/html-template.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'tpl-1', createdAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
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
  let service: TemplatesService;

  beforeEach(() => {
    repo = repoMock();
    service = new TemplatesService(repo as never);
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
});
