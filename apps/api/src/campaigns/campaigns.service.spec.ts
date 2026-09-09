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
  };
}

describe('CampaignsService', () => {
  const PUBLIC_BASE_URL = 'http://localhost:3001';
  let campaignRepo: ReturnType<typeof repoMock>;
  let formRepo: ReturnType<typeof repoMock>;
  let service: CampaignsService;

  beforeEach(() => {
    campaignRepo = repoMock();
    formRepo = repoMock();
    service = new CampaignsService(campaignRepo as never, formRepo as never, PUBLIC_BASE_URL);
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

    it('status를 archived로 변경할 수 있다', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', name: 'X', status: 'active' } as Campaign);
      const result = await service.update('camp-1', { status: 'archived' });
      expect(result.status).toBe('archived');
    });
  });
});
