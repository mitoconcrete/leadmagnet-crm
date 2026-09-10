import { NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { Campaign } from '../entities/campaign.entity';
import { Form } from '../entities/form.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'camp-1', createdAt: new Date(), updatedAt: new Date(), status: 'active', ...(v as object) })),
    create: jest.fn((v: unknown) => v),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

/**
 * ADR 0019 개정: findAll은 forms/activeForms 집계를 위해 QueryBuilder.getRawMany()를
 * 쓴다. leftJoin/select/groupBy/orderBy는 체이닝만 검증하면 되므로 this를 반환한다.
 */
function queryBuilderMock(rawRows: unknown[]) {
  const qb = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
  };
  qb.leftJoin.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
}

/**
 * ADR 0019: archived 전환 시 dataSource.transaction 안에서만 폼을 일괄 비활성화하는지,
 * 삭제 시 트랜잭션 안에서 링크→폼→캠페인 순으로 지우는지 검증하기 위한 manager mock.
 * `query`는 삭제(distribution_links, forms 원시 DELETE)용이다.
 */
function managerMock(map: Map<unknown, ReturnType<typeof repoMock>>) {
  return {
    getRepository: jest.fn((entity: unknown) => map.get(entity)),
    query: jest.fn().mockResolvedValue(undefined),
  };
}

function dataSourceMock(manager: ReturnType<typeof managerMock>) {
  return {
    transaction: jest.fn((cb: (manager: ReturnType<typeof managerMock>) => unknown) => cb(manager)),
    query: jest.fn(),
  };
}

describe('CampaignsService', () => {
  const PUBLIC_BASE_URL = 'http://localhost:3001';
  let campaignRepo: ReturnType<typeof repoMock>;
  let formRepo: ReturnType<typeof repoMock>;
  let txCampaignRepo: ReturnType<typeof repoMock>;
  let txFormRepo: ReturnType<typeof repoMock>;
  let manager: ReturnType<typeof managerMock>;
  let dataSource: ReturnType<typeof dataSourceMock>;
  let service: CampaignsService;

  beforeEach(() => {
    campaignRepo = repoMock();
    formRepo = repoMock();
    txCampaignRepo = repoMock();
    txFormRepo = repoMock();
    manager = managerMock(
      new Map<unknown, ReturnType<typeof repoMock>>([
        [Campaign, txCampaignRepo],
        [Form, txFormRepo],
      ]),
    );
    dataSource = dataSourceMock(manager);
    service = new CampaignsService(campaignRepo as never, formRepo as never, PUBLIC_BASE_URL, dataSource as never);
  });

  it('create는 기본 status active로 저장한다', async () => {
    const campaign = await service.create({ name: '여름 프로모션' });
    expect(campaign.name).toBe('여름 프로모션');
    expect(campaign.status).toBe('active');
  });

  describe('findAll (ADR 0019 개정: forms/activeForms 수)', () => {
    it('단일 QueryBuilder 쿼리로 각 캠페인 행에 forms(전체)·activeForms(활성) 수를 포함한다', async () => {
      const qb = queryBuilderMock([
        {
          id: 'camp-1',
          name: '캠페인A',
          description: null,
          status: 'active',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          forms: '2',
          activeForms: '1',
        },
      ]);
      campaignRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(campaignRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.getRawMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        expect.objectContaining({ id: 'camp-1', name: '캠페인A', status: 'active', forms: 2, activeForms: 1 }),
      ]);
    });

    it('폼이 없으면 forms/activeForms 모두 0이다', async () => {
      const qb = queryBuilderMock([
        {
          id: 'camp-2',
          name: '캠페인B',
          description: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          forms: '0',
          activeForms: '0',
        },
      ]);
      campaignRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();
      expect(result[0].forms).toBe(0);
      expect(result[0].activeForms).toBe(0);
    });
  });

  describe('findOneWithForms', () => {
    it('캠페인이 없으면 404', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneWithForms('missing')).rejects.toThrow(NotFoundException);
    });

    it('폼 목록을 publicUrl과 함께 포함한다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      formRepo.find.mockResolvedValue([{ id: 'f1', slug: 'my-slug' } as Form]);
      const result = await service.findOneWithForms('camp-1');
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].publicUrl).toBe('http://localhost:3001/p/my-slug');
    });

    it('§4.4/ADR 0017: template 관계를 함께 조회해(쿼리 추가 없이) forms[].templateDeleted를 정확히 계산한다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      formRepo.find.mockResolvedValue([
        { id: 'f1', slug: 'my-slug', template: { id: 'tpl-1', deletedAt: new Date() } } as unknown as Form,
      ]);

      const result = await service.findOneWithForms('camp-1');

      expect(formRepo.find).toHaveBeenCalledWith(expect.objectContaining({ relations: ['template'] }));
      expect(result.forms[0].templateDeleted).toBe(true);
    });
  });

  describe('ensureExists', () => {
    it('캠페인이 없으면 404', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.ensureExists('missing')).rejects.toThrow(NotFoundException);
    });

    it('ADR 0017: 있으면 그냥 통과한다(폼은 조회하지 않는다)', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      await expect(service.ensureExists('camp-1')).resolves.toBeUndefined();
      expect(formRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('없는 캠페인이면 404', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('ADR 0019: status를 archived로 변경하면 트랜잭션 안에서 캠페인 저장 + 소속 폼 전부 isActive=false로 갱신한다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      const result = await service.update('camp-1', { status: 'archived' });

      expect(result.status).toBe('archived');
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.getRepository).toHaveBeenCalledWith(Campaign);
      expect(manager.getRepository).toHaveBeenCalledWith(Form);
      expect(txCampaignRepo.save).toHaveBeenCalled();
      expect(txFormRepo.update).toHaveBeenCalledWith({ campaignId: 'camp-1' }, { isActive: false });
      // 트랜잭션 밖(생성자 주입) 리포지토리로는 쓰지 않는다.
      expect(campaignRepo.save).not.toHaveBeenCalled();
    });

    it('ADR 0019: status를 active로 재개하면 트랜잭션 없이 캠페인만 갱신하고 폼은 그대로 둔다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'archived' } as Campaign);
      const result = await service.update('camp-1', { status: 'active' });

      expect(result.status).toBe('active');
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(campaignRepo.save).toHaveBeenCalled();
      expect(formRepo.update).not.toHaveBeenCalled();
    });

    it('ADR 0019: 이미 같은 status면 트랜잭션 없이 그대로 저장한다(변경 없음)', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'archived' } as Campaign);
      const result = await service.update('camp-1', { status: 'archived' });

      expect(result.status).toBe('archived');
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(campaignRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove (ADR 0019 개정 + TOCTOU 픽스: 트랜잭션 안에서 락·재집계)', () => {
    it('캠페인이 없으면 404이고 트랜잭션을 시작하지 않는다', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('트랜잭션 안에서 캠페인 행을 SELECT … FOR UPDATE로 잠그고, 같은 manager로 이벤트를 재집계해 0이면 링크→폼→캠페인 순으로 지운다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'archived' } as Campaign);
      manager.query
        .mockResolvedValueOnce([{ id: 'camp-1' }]) // FOR UPDATE 락
        .mockResolvedValueOnce([{ forms: 1, visits: 0, submissions: 0 }]) // 재집계
        .mockResolvedValueOnce(undefined) // DELETE distribution_links
        .mockResolvedValueOnce(undefined); // DELETE forms

      await service.remove('camp-1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(manager.query.mock.calls[0][0]).toMatch(/FOR UPDATE/i);
      expect(manager.query.mock.calls[1][0]).toMatch(/COUNT/i);
      expect(manager.query.mock.calls[1][0]).toMatch(/campaign_id/i);
      expect(manager.query.mock.calls[2][0]).toMatch(/DELETE FROM distribution_links/i);
      expect(manager.query.mock.calls[3][0]).toMatch(/DELETE FROM forms/i);
      expect(txCampaignRepo.delete).toHaveBeenCalledWith('camp-1');
      // 트랜잭션 밖 리포지토리·dataSource로는 읽지도 쓰지도 않는다(재집계는 반드시 같은 manager로).
      expect(campaignRepo.update).not.toHaveBeenCalled();
    });

    it('재집계 결과 방문이 1건이라도 있으면 409+details를 던지고 롤백한다(삭제 쿼리를 실행하지 않는다)', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      manager.query
        .mockResolvedValueOnce([{ id: 'camp-1' }]) // FOR UPDATE 락
        .mockResolvedValueOnce([{ forms: 2, visits: 1, submissions: 0 }]); // 재집계: 방문 있음

      await expect(service.remove('camp-1')).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          message: '이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요',
          details: { forms: 2, visits: 1, submissions: 0 },
        }),
      });

      expect(manager.query).toHaveBeenCalledTimes(2); // 락 + 재집계뿐, DELETE는 없다
      expect(txCampaignRepo.delete).not.toHaveBeenCalled();
    });

    it('재집계 결과 신청이 1건이라도 있으면 409+details를 던진다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      manager.query
        .mockResolvedValueOnce([{ id: 'camp-1' }])
        .mockResolvedValueOnce([{ forms: 1, visits: 0, submissions: 1 }]);

      await expect(service.remove('camp-1')).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({ details: { forms: 1, visits: 0, submissions: 1 } }),
      });
      expect(txCampaignRepo.delete).not.toHaveBeenCalled();
    });

    it('TOCTOU 최후 방어: 재집계는 0이었지만 삭제 도중 FK 위반(23503)이 나면 409로 매핑한다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      manager.query
        .mockResolvedValueOnce([{ id: 'camp-1' }]) // FOR UPDATE 락
        .mockResolvedValueOnce([{ forms: 1, visits: 0, submissions: 0 }]) // 재집계: 0
        .mockResolvedValueOnce(undefined) // DELETE distribution_links
        .mockRejectedValueOnce(Object.assign(new Error('foreign key violation'), { code: '23503' })); // DELETE forms 중 경합 발생

      await expect(service.remove('camp-1')).rejects.toMatchObject({
        status: 409,
        response: expect.objectContaining({
          message: '이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요',
        }),
      });
    });

    it('FK 위반이 아닌 다른 오류는 그대로 던진다(409로 뭉개지 않는다)', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      manager.query
        .mockResolvedValueOnce([{ id: 'camp-1' }])
        .mockResolvedValueOnce([{ forms: 1, visits: 0, submissions: 0 }])
        .mockRejectedValueOnce(new Error('커넥션 끊김'));

      await expect(service.remove('camp-1')).rejects.toThrow('커넥션 끊김');
    });
  });
});
