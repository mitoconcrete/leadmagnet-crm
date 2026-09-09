import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';
import { Form } from '../entities/form.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'id-1', createdAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
  };
}

const activeForm: Form = {
  id: 'form-1',
  slug: 'my-form',
  isActive: true,
  successMessage: '신청이 완료되었습니다.',
} as Form;

describe('PublicService', () => {
  let formRepo: ReturnType<typeof repoMock>;
  let visitorRepo: ReturnType<typeof repoMock>;
  let visitRepo: ReturnType<typeof repoMock>;
  let submissionRepo: ReturnType<typeof repoMock>;
  let linkRepo: ReturnType<typeof repoMock>;
  let service: PublicService;

  beforeEach(() => {
    formRepo = repoMock();
    visitorRepo = repoMock();
    visitRepo = repoMock();
    submissionRepo = repoMock();
    linkRepo = repoMock();
    service = new PublicService(formRepo as never, visitorRepo as never, visitRepo as never, submissionRepo as never, linkRepo as never);
  });

  describe('recordVisit', () => {
    it('폼이 없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.recordVisit({ slug: 'missing' })).rejects.toThrow(NotFoundException);
    });

    it('비활성 폼이면 404', async () => {
      formRepo.findOne.mockResolvedValue({ ...activeForm, isActive: false });
      await expect(service.recordVisit({ slug: 'my-form' })).rejects.toThrow(NotFoundException);
    });

    it('src 없으면 direct로 귀속된다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      const result = await service.recordVisit({ slug: 'my-form' });
      expect(result.visit.channel).toBe('direct');
      expect(result.visit.linkId).toBeNull();
    });

    it('src가 그 폼의 링크 코드면 linkId/channel로 귀속된다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', formId: 'form-1', channel: 'instagram', code: 'abc12345' });
      const result = await service.recordVisit({ slug: 'my-form', src: 'abc12345' });
      expect(result.visit.channel).toBe('instagram');
      expect(result.visit.linkId).toBe('link-1');
    });

    it('src가 다른 폼의 링크 코드면 direct로 귀속된다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      linkRepo.findOne.mockResolvedValue({ id: 'link-1', formId: 'other-form', channel: 'instagram', code: 'abc12345' });
      const result = await service.recordVisit({ slug: 'my-form', src: 'abc12345' });
      expect(result.visit.channel).toBe('direct');
      expect(result.visit.linkId).toBeNull();
    });

    it('visitorId가 있으면 방문자를 갱신하고, 없으면 생성한다', async () => {
      const visitorId = '11111111-1111-1111-1111-111111111111';
      formRepo.findOne.mockResolvedValue(activeForm);
      visitorRepo.findOne.mockResolvedValue({ id: visitorId, firstSeenAt: new Date(), lastSeenAt: new Date() });
      const result = await service.recordVisit({ slug: 'my-form', visitorId });
      expect(result.visitor.id).toBe(visitorId);
      expect(visitorRepo.save).toHaveBeenCalled();
    });

    it('visitorId가 uuid 형식이 아니면 조회하지 않고 새 visitor를 발급한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      const result = await service.recordVisit({ slug: 'my-form', visitorId: 'not-a-uuid' });
      expect(visitorRepo.findOne).not.toHaveBeenCalled();
      expect(result.visitor.id).toBe('id-1');
    });
  });

  describe('submit', () => {
    it('폼이 없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.submit('missing', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fields가 빈 객체면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      await expect(service.submit('my-form', { visitToken: 'v1', fields: {} })).rejects.toThrow(BadRequestException);
    });

    it('visit이 없으면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue(null);
      await expect(
        service.submit('my-form', { visitToken: 'missing-visit', fields: { name: 'a' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('visit의 formId가 일치하지 않으면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'other-form' });
      await expect(service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('성공하면 id와 message를 반환한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      const result = await service.submit('my-form', { visitToken: 'v1', fields: { name: '홍길동' } });
      expect(result.message).toBe('신청이 완료되었습니다.');
      expect(result.id).toBeDefined();
    });

    it('문자열 배열 값도 허용한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      const result = await service.submit('my-form', {
        visitToken: 'v1',
        fields: { interest: ['A', 'B'] },
      });
      expect(result.id).toBeDefined();
    });

    it('값이 객체이면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: { nested: true } } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('값이 문자열이 아닌 원소를 포함한 배열이면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      visitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: ['a', 1] } }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
