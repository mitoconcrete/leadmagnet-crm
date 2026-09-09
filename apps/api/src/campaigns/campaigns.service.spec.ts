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
  };
}

/** ADR 0019: archived 전환 시 dataSource.transaction 안에서만 폼을 일괄 비활성화하는지 검증하기 위한 manager mock. */
function managerMock(map: Map<unknown, ReturnType<typeof repoMock>>) {
  return { getRepository: jest.fn((entity: unknown) => map.get(entity)) };
}

function dataSourceMock(manager: ReturnType<typeof managerMock>) {
  return {
    transaction: jest.fn((cb: (manager: ReturnType<typeof managerMock>) => unknown) => cb(manager)),
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

  it('findAll은 저장소 목록을 반환한다', async () => {
    const list: Campaign[] = [];
    campaignRepo.find.mockResolvedValue(list);
    expect(await service.findAll()).toBe(list);
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
});
