import { ConflictException, NotFoundException } from '@nestjs/common';
import { FormsService } from './forms.service';
import { Campaign } from '../entities/campaign.entity';
import { HtmlTemplate } from '../entities/html-template.entity';
import { Form } from '../entities/form.entity';

function repoMock() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 'form-1', createdAt: new Date(), updatedAt: new Date(), ...(v as object) })),
    create: jest.fn((v: unknown) => v),
  };
}

const campaign: Campaign = { id: 'camp-1' } as Campaign;
const template: HtmlTemplate = { id: 'tpl-1' } as HtmlTemplate;

describe('FormsService', () => {
  const PUBLIC_BASE_URL = 'http://localhost:3001';
  let formRepo: ReturnType<typeof repoMock>;
  let campaignRepo: ReturnType<typeof repoMock>;
  let templateRepo: ReturnType<typeof repoMock>;
  let service: FormsService;

  beforeEach(() => {
    formRepo = repoMock();
    campaignRepo = repoMock();
    templateRepo = repoMock();
    campaignRepo.findOne.mockResolvedValue(campaign);
    templateRepo.findOne.mockResolvedValue(template);
    formRepo.findOne.mockResolvedValue(null);
    service = new FormsService(formRepo as never, campaignRepo as never, templateRepo as never, PUBLIC_BASE_URL);
  });

  describe('create', () => {
    it('slug 미지정 시 name 기반으로 자동 생성한다', async () => {
      const form = await service.create({ campaignId: 'camp-1', templateId: 'tpl-1', name: 'Summer Sale' });
      expect(form.slug).toMatch(/^summer-sale-[a-z0-9]{4}$/);
    });

    it('slug 지정 시 그대로 사용한다', async () => {
      const form = await service.create({ campaignId: 'camp-1', templateId: 'tpl-1', name: 'X', slug: 'my-slug' });
      expect(form.slug).toBe('my-slug');
    });

    it('중복 slug면 ConflictException', async () => {
      formRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ campaignId: 'camp-1', templateId: 'tpl-1', name: 'X', slug: 'dup' }),
      ).rejects.toThrow(ConflictException);
    });

    it('campaignId가 없으면 404', async () => {
      campaignRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ campaignId: 'missing', templateId: 'tpl-1', name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('templateId가 없으면 404', async () => {
      templateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ campaignId: 'camp-1', templateId: 'missing', name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADR 0019: 캠페인이 종료(archived)면 409', async () => {
      campaignRepo.findOne.mockResolvedValue({ id: 'camp-1', status: 'archived' } as Campaign);
      await expect(
        service.create({ campaignId: 'camp-1', templateId: 'tpl-1', name: 'X' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('toResponse', () => {
    it('publicUrl을 PUBLIC_BASE_URL과 slug로 조합한다', () => {
      const form = {
        id: 'f1',
        campaignId: 'camp-1',
        templateId: 'tpl-1',
        name: 'X',
        slug: 'x-slug',
        successMessage: '신청이 완료되었습니다.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Form;
      const response = service.toResponse(form);
      expect(response.publicUrl).toBe('http://localhost:3001/p/x-slug');
    });

    it('템플릿 관계가 소프트 삭제 상태면 templateDeleted:true를 반환한다', () => {
      const form = {
        id: 'f1',
        campaignId: 'camp-1',
        templateId: 'tpl-1',
        name: 'X',
        slug: 'x-slug',
        successMessage: '신청이 완료되었습니다.',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: { id: 'tpl-1', deletedAt: new Date() },
      } as unknown as Form;
      expect(service.toResponse(form).templateDeleted).toBe(true);
    });

    it('템플릿 관계가 로드되지 않았거나 삭제되지 않았으면 templateDeleted:false다', () => {
      const form = {
        id: 'f1',
        campaignId: 'camp-1',
        templateId: 'tpl-1',
        name: 'X',
        slug: 'x-slug',
        successMessage: '신청이 완료되었습니다.',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Form;
      expect(service.toResponse(form).templateDeleted).toBe(false);
    });
  });

  describe('findAll', () => {
    it('campaignId 없이 호출하면 전체 목록을 반환한다', async () => {
      const list: Form[] = [];
      formRepo.find.mockResolvedValue(list);
      expect(await service.findAll()).toBe(list);
    });

    it('campaignId로 필터링해 조회한다', async () => {
      const list: Form[] = [];
      formRepo.find.mockResolvedValue(list);
      await service.findAll('camp-1');
      expect(formRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { campaignId: 'camp-1' } }),
      );
    });

    it('templateDeleted 계산을 위해 template 관계를 함께 조회한다', async () => {
      const list: Form[] = [];
      formRepo.find.mockResolvedValue(list);
      await service.findAll();
      expect(formRepo.find).toHaveBeenCalledWith(expect.objectContaining({ relations: ['template'] }));
    });
  });

  describe('findOne', () => {
    it('없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('있으면 반환한다', async () => {
      const form = { id: 'f1' } as Form;
      formRepo.findOne.mockResolvedValue(form);
      expect(await service.findOne('f1')).toBe(form);
    });
  });

  describe('findOneWithLinks', () => {
    it('없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneWithLinks('missing')).rejects.toThrow(NotFoundException);
    });

    it('links·template 관계를 포함해 조회한다', async () => {
      const form = { id: 'f1', links: [] } as unknown as Form;
      formRepo.findOne.mockResolvedValue(form);
      const result = await service.findOneWithLinks('f1');
      expect(result).toBe(form);
      expect(formRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['links', 'template'] }),
      );
    });
  });

  describe('update', () => {
    it('없으면 404', async () => {
      formRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('templateId가 유효하지 않으면 404', async () => {
      formRepo.findOne.mockResolvedValue({ id: 'f1', templateId: 'old-tpl' } as Form);
      templateRepo.findOne.mockResolvedValue(null);
      await expect(service.update('f1', { templateId: 'missing-tpl' })).rejects.toThrow(NotFoundException);
    });

    it('필드를 부분 업데이트한다', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: true,
        templateId: 'old-tpl',
      } as Form);
      const result = await service.update('f1', {
        name: 'new',
        successMessage: 'new-msg',
        isActive: false,
        templateId: 'tpl-1',
      });
      expect(result.name).toBe('new');
      expect(result.successMessage).toBe('new-msg');
      expect(result.isActive).toBe(false);
      expect(result.templateId).toBe('tpl-1');
    });

    it('필드를 지정하지 않으면 기존 값을 유지한다', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: true,
        templateId: 'old-tpl',
      } as Form);
      const result = await service.update('f1', {});
      expect(result.name).toBe('old');
      expect(result.templateId).toBe('old-tpl');
    });

    it('템플릿이 소프트 삭제된 폼을 isActive:true로 바꾸려 하면 409', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: false,
        templateId: 'deleted-tpl',
      } as Form);
      templateRepo.findOne.mockResolvedValue({ id: 'deleted-tpl', deletedAt: new Date() });

      await expect(service.update('f1', { isActive: true })).rejects.toThrow(ConflictException);
      expect(formRepo.save).not.toHaveBeenCalled();
    });

    it('템플릿이 존재하지 않는 폼을 isActive:true로 바꾸려 해도 409', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: false,
        templateId: 'missing-tpl',
      } as Form);
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.update('f1', { isActive: true })).rejects.toThrow(ConflictException);
    });

    it('살아 있는 templateId로 교체하면서 isActive:true를 함께 보내면 허용한다', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: false,
        templateId: 'deleted-tpl',
      } as Form);
      templateRepo.findOne.mockResolvedValue({ id: 'tpl-1', deletedAt: null });

      const result = await service.update('f1', { templateId: 'tpl-1', isActive: true });

      expect(result.templateId).toBe('tpl-1');
      expect(result.isActive).toBe(true);
    });

    it('템플릿이 삭제됐어도 isActive:false나 이름 변경은 허용한다', async () => {
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: true,
        templateId: 'deleted-tpl',
      } as Form);

      const result = await service.update('f1', { isActive: false, name: '이름 변경' });

      expect(result.isActive).toBe(false);
      expect(result.name).toBe('이름 변경');
      expect(templateRepo.findOne).not.toHaveBeenCalled();
    });

    it('template 관계를 포함해 조회해 PATCH 응답의 templateDeleted를 정확히 계산할 수 있게 한다', async () => {
      const deletedTemplate = { id: 'tpl-1', deletedAt: new Date() };
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: false,
        templateId: 'tpl-1',
        template: deletedTemplate,
      } as unknown as Form);

      const result = await service.update('f1', { name: '변경' });

      expect(formRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ relations: ['template'] }));
      expect(result.template).toEqual(deletedTemplate);
    });

    it('살아 있는 templateId로 교체하면 반환된 폼의 template 관계도 그 템플릿으로 갱신된다', async () => {
      const oldDeletedTemplate = { id: 'deleted-tpl', deletedAt: new Date() };
      const newLiveTemplate = { id: 'tpl-1', deletedAt: null };
      formRepo.findOne.mockResolvedValue({
        id: 'f1',
        name: 'old',
        successMessage: 'old-msg',
        isActive: false,
        templateId: 'deleted-tpl',
        template: oldDeletedTemplate,
      } as unknown as Form);
      templateRepo.findOne.mockResolvedValue(newLiveTemplate);

      const result = await service.update('f1', { templateId: 'tpl-1', isActive: true });

      expect((result as unknown as { template: unknown }).template).toEqual(newLiveTemplate);
    });
  });
});
