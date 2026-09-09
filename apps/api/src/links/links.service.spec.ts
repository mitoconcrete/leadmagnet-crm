import { ConflictException, NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { Form } from '../entities/form.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'link-1', createdAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
  };
}

const form = { id: 'form-1', slug: 'my-form' } as Form;

describe('LinksService', () => {
  const PUBLIC_BASE_URL = 'http://localhost:3001';
  let linkRepo: ReturnType<typeof repoMock>;
  let formRepo: ReturnType<typeof repoMock>;
  let service: LinksService;

  beforeEach(() => {
    linkRepo = repoMock();
    formRepo = repoMock();
    formRepo.findOne.mockResolvedValue(form);
    linkRepo.findOne.mockResolvedValue(null);
    service = new LinksService(linkRepo as never, formRepo as never, PUBLIC_BASE_URL);
  });

  describe('create', () => {
    it('폼이 없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.create('missing', 'instagram')).rejects.toThrow(NotFoundException);
    });

    it('같은 채널이 이미 있으면 409', async () => {
      linkRepo.findOne.mockResolvedValueOnce({ id: 'existing' });
      await expect(service.create('form-1', 'instagram')).rejects.toThrow(ConflictException);
    });

    it('ADR 0019: 폼의 캠페인이 종료(archived)면 409', async () => {
      formRepo.findOne.mockResolvedValue({ ...form, campaign: { id: 'camp-1', status: 'archived' } });
      await expect(service.create('form-1', 'instagram')).rejects.toThrow(ConflictException);
      expect(formRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ relations: ['campaign'] }));
    });

    it('코드는 8자 base62다', async () => {
      const link = await service.create('form-1', 'instagram');
      expect(link.code).toHaveLength(8);
      expect(link.code).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('코드가 충돌하면 재생성한다', async () => {
      linkRepo.findOne
        .mockResolvedValueOnce(null) // 채널 중복 확인
        .mockResolvedValueOnce({ id: 'dup' }) // 첫 코드 충돌
        .mockResolvedValueOnce(null); // 두번째 코드는 사용 가능
      const link = await service.create('form-1', 'x');
      expect(link.code).toHaveLength(8);
      expect(linkRepo.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('toResponse', () => {
    it('url을 publicBaseUrl/p/slug?src=code 형식으로 조합한다', () => {
      const link = { id: 'l1', formId: 'form-1', channel: 'instagram', code: 'abcd1234', createdAt: new Date() };
      const response = service.toResponse(link as never, form);
      expect(response.url).toBe('http://localhost:3001/p/my-form?src=abcd1234');
    });
  });

  it('findByForm은 저장소 목록을 반환한다', async () => {
    const list: unknown[] = [];
    linkRepo.find.mockResolvedValue(list);
    expect(await service.findByForm('form-1')).toBe(list);
  });

  it('findByCode는 코드로 조회한다', async () => {
    const link = { id: 'l1' };
    linkRepo.findOne.mockResolvedValue(link);
    expect(await service.findByCode('abcd1234')).toBe(link);
  });
});
