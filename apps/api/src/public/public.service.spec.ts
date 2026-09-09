import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PublicService } from './public.service';
import { Form } from '../entities/form.entity';
import { Visitor } from '../entities/visitor.entity';
import { Visit } from '../entities/visit.entity';
import { Submission } from '../entities/submission.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'id-1', createdAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
  };
}

/** ADR 0017: 트랜잭션 콜백에 넘어가는 manager. entity 클래스별로 다른 mock 리포지토리를 반환해
 *  "manager로 조회·저장했는지"와 "외부(비트랜잭션) repo는 안 썼는지"를 구분해서 단언할 수 있게 한다. */
function managerMock(map: Map<unknown, ReturnType<typeof repoMock>>) {
  return { getRepository: jest.fn((entity: unknown) => map.get(entity)) };
}

function dataSourceMock(manager: ReturnType<typeof managerMock>) {
  return {
    transaction: jest.fn((cb: (manager: ReturnType<typeof managerMock>) => unknown) => cb(manager)),
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
  // 트랜잭션 안(manager.getRepository)에서만 쓰여야 하는 리포지토리들.
  let txVisitorRepo: ReturnType<typeof repoMock>;
  let txVisitRepo: ReturnType<typeof repoMock>;
  let txSubmissionRepo: ReturnType<typeof repoMock>;
  let manager: ReturnType<typeof managerMock>;
  let dataSource: ReturnType<typeof dataSourceMock>;
  let service: PublicService;

  beforeEach(() => {
    formRepo = repoMock();
    visitorRepo = repoMock();
    visitRepo = repoMock();
    submissionRepo = repoMock();
    linkRepo = repoMock();
    txVisitorRepo = repoMock();
    txVisitRepo = repoMock();
    txSubmissionRepo = repoMock();
    manager = managerMock(
      new Map<unknown, ReturnType<typeof repoMock>>([
        [Visitor, txVisitorRepo],
        [Visit, txVisitRepo],
        [Submission, txSubmissionRepo],
      ]),
    );
    dataSource = dataSourceMock(manager);
    service = new PublicService(
      formRepo as never,
      visitorRepo as never,
      visitRepo as never,
      submissionRepo as never,
      linkRepo as never,
      dataSource as never,
    );
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

    it('템플릿이 소프트 삭제되었으면 is_active와 무관하게 404다(심층 방어)', async () => {
      formRepo.findOne.mockResolvedValue({
        ...activeForm,
        isActive: true,
        template: { id: 'tpl-1', deletedAt: new Date() },
      });
      await expect(service.recordVisit({ slug: 'my-form' })).rejects.toThrow(NotFoundException);
    });

    it('ADR 0019 보완: 캠페인이 종료(archived)면 is_active와 무관하게 404다(심층 방어)', async () => {
      formRepo.findOne.mockResolvedValue({
        ...activeForm,
        isActive: true,
        campaign: { id: 'camp-1', status: 'archived' },
      });
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
      txVisitorRepo.findOne.mockResolvedValue({ id: visitorId, firstSeenAt: new Date(), lastSeenAt: new Date() });
      const result = await service.recordVisit({ slug: 'my-form', visitorId });
      expect(result.visitor.id).toBe(visitorId);
      expect(txVisitorRepo.save).toHaveBeenCalled();
    });

    it('visitorId가 uuid 형식이 아니면 조회하지 않고 새 visitor를 발급한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      const result = await service.recordVisit({ slug: 'my-form', visitorId: 'not-a-uuid' });
      expect(txVisitorRepo.findOne).not.toHaveBeenCalled();
      expect(result.visitor.id).toBe('id-1');
    });

    it('ADR 0017: dataSource.transaction 안에서 manager.getRepository로 visitor·visit을 조회/저장하고, 생성자로 주입된 visitorRepo/visitRepo는 쓰지 않는다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      await service.recordVisit({ slug: 'my-form' });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(Visitor);
      expect(manager.getRepository).toHaveBeenCalledWith(Visit);
      expect(txVisitorRepo.save).toHaveBeenCalled();
      expect(txVisitRepo.save).toHaveBeenCalled();
      expect(visitorRepo.save).not.toHaveBeenCalled();
      expect(visitRepo.save).not.toHaveBeenCalled();
    });

    it('ADR 0017: visit insert(두 번째 쓰기)가 실패하면 예외가 그대로 전파된다(롤백은 TypeORM 책임)', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.save.mockRejectedValue(new Error('insert failed'));
      await expect(service.recordVisit({ slug: 'my-form' })).rejects.toThrow('insert failed');
      expect(txVisitorRepo.save).toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('폼이 없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.submit('missing', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('템플릿이 소프트 삭제되었으면 is_active와 무관하게 404다(심층 방어)', async () => {
      formRepo.findOne.mockResolvedValue({
        ...activeForm,
        isActive: true,
        template: { id: 'tpl-1', deletedAt: new Date() },
      });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADR 0019 보완: 캠페인이 종료(archived)면 is_active와 무관하게 404다(심층 방어)', async () => {
      formRepo.findOne.mockResolvedValue({
        ...activeForm,
        isActive: true,
        campaign: { id: 'camp-1', status: 'archived' },
      });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('fields가 빈 객체면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      await expect(service.submit('my-form', { visitToken: 'v1', fields: {} })).rejects.toThrow(BadRequestException);
    });

    it('visit이 없으면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue(null);
      await expect(
        service.submit('my-form', { visitToken: 'missing-visit', fields: { name: 'a' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('visit의 formId가 일치하지 않으면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'other-form' });
      await expect(service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('성공하면 id와 message를 반환한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      const result = await service.submit('my-form', { visitToken: 'v1', fields: { name: '홍길동' } });
      expect(result.message).toBe('신청이 완료되었습니다.');
      expect(result.id).toBeDefined();
    });

    it('문자열 배열 값도 허용한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      const result = await service.submit('my-form', {
        visitToken: 'v1',
        fields: { interest: ['A', 'B'] },
      });
      expect(result.id).toBeDefined();
    });

    it('값이 객체이면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: { nested: true } } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('값이 문자열이 아닌 원소를 포함한 배열이면 400', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      await expect(
        service.submit('my-form', { visitToken: 'v1', fields: { name: ['a', 1] } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('같은 visit으로 이미 제출된 적이 있으면 409', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      txSubmissionRepo.findOne.mockResolvedValue({ id: 'sub-1', visitId: 'v1' });
      await expect(service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        ConflictException,
      );
      expect(txSubmissionRepo.save).not.toHaveBeenCalled();
    });

    it('저장 시 UNIQUE 위반(경쟁 상태)이면 409로 변환한다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      txSubmissionRepo.findOne.mockResolvedValue(null);
      txSubmissionRepo.save.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));
      await expect(service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        ConflictException,
      );
    });

    it('ADR 0017: dataSource.transaction 안에서 manager.getRepository로 visit 검증·중복 확인·submission 저장을 하고, 생성자로 주입된 visitRepo/submissionRepo는 쓰지 않는다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      await service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(Visit);
      expect(manager.getRepository).toHaveBeenCalledWith(Submission);
      expect(txSubmissionRepo.save).toHaveBeenCalled();
      expect(visitRepo.findOne).not.toHaveBeenCalled();
      expect(submissionRepo.save).not.toHaveBeenCalled();
    });

    it('ADR 0017: submission insert(두 번째 쓰기)가 실패(UNIQUE 위반 아님)하면 예외가 그대로 전파된다', async () => {
      formRepo.findOne.mockResolvedValue(activeForm);
      txVisitRepo.findOne.mockResolvedValue({ id: 'v1', formId: 'form-1', visitorId: 'visitor-1', linkId: null, channel: 'direct' });
      txSubmissionRepo.findOne.mockResolvedValue(null);
      txSubmissionRepo.save.mockRejectedValue(new Error('insert failed'));
      await expect(service.submit('my-form', { visitToken: 'v1', fields: { name: 'a' } })).rejects.toThrow(
        'insert failed',
      );
    });
  });
});
