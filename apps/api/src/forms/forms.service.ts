import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Form } from '../entities/form.entity';
import { Campaign } from '../entities/campaign.entity';
import { HtmlTemplate } from '../entities/html-template.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { slugify, randomSuffix } from '../common/slug';
import { PUBLIC_BASE_URL } from '../common/tokens';

export interface FormResponse {
  id: string;
  campaignId: string;
  templateId: string;
  name: string;
  slug: string;
  successMessage: string;
  isActive: boolean;
  publicUrl: string;
  createdAt: Date;
  updatedAt: Date;
  /** 폼이 참조하는 템플릿이 소프트 삭제됐는지(ADR 0014 보완). template 관계가 로드되지 않았으면 false다. */
  templateDeleted: boolean;
}

export function toFormResponse(form: Form, publicBaseUrl: string): FormResponse {
  return {
    id: form.id,
    campaignId: form.campaignId,
    templateId: form.templateId,
    name: form.name,
    slug: form.slug,
    successMessage: form.successMessage,
    isActive: form.isActive,
    publicUrl: `${publicBaseUrl}/p/${form.slug}`,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    templateDeleted: Boolean(form.template?.deletedAt),
  };
}

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form) private readonly formRepo: Repository<Form>,
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(HtmlTemplate) private readonly templateRepo: Repository<HtmlTemplate>,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
  ) {}

  async create(dto: CreateFormDto): Promise<Form> {
    const campaign = await this.campaignRepo.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException('캠페인을 찾을 수 없습니다');
    if (campaign.status === 'archived') throw new ConflictException('종료된 캠페인입니다');
    const template = await this.templateRepo.findOne({ where: { id: dto.templateId, deletedAt: IsNull() } });
    if (!template) throw new NotFoundException('템플릿을 찾을 수 없습니다');

    let slug = dto.slug;
    if (slug) {
      const existing = await this.formRepo.findOne({ where: { slug } });
      if (existing) throw new ConflictException('이미 사용 중인 슬러그입니다');
    } else {
      slug = `${slugify(dto.name)}-${randomSuffix()}`;
    }

    return this.formRepo.save(
      this.formRepo.create({
        campaignId: dto.campaignId,
        templateId: dto.templateId,
        name: dto.name,
        slug,
        successMessage: dto.successMessage ?? '신청이 완료되었습니다.',
      }),
    );
  }

  findAll(campaignId?: string): Promise<Form[]> {
    return this.formRepo.find({
      where: campaignId ? { campaignId } : {},
      relations: ['template'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Form> {
    const found = await this.formRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('폼을 찾을 수 없습니다');
    return found;
  }

  async findOneWithLinks(id: string): Promise<Form> {
    const found = await this.formRepo.findOne({ where: { id }, relations: ['links', 'template'] });
    if (!found) throw new NotFoundException('폼을 찾을 수 없습니다');
    return found;
  }

  /**
   * ADR 0014 보완: 템플릿이 소프트 삭제된 폼은 isActive:true로 다시 켤 수 없다(409).
   * 단, 같은 요청에 살아 있는 templateId로의 교체가 함께 오면 허용한다(템플릿 교체 후 활성화).
   * 응답의 templateDeleted를 정확히 계산할 수 있도록 template 관계를 함께 로드하고,
   * templateId를 바꾸는 경우 그 관계도 새 템플릿으로 갱신해 반환한다(재조회 쿼리 없이,
   * to-one 관계라 findOne 1회로 로드됨 — ADR 0017 상한 유지).
   */
  async update(id: string, dto: UpdateFormDto): Promise<Form> {
    const form = await this.formRepo.findOne({ where: { id }, relations: ['template'] });
    if (!form) throw new NotFoundException('폼을 찾을 수 없습니다');

    if (dto.templateId) {
      const template = await this.templateRepo.findOne({ where: { id: dto.templateId, deletedAt: IsNull() } });
      if (!template) throw new NotFoundException('템플릿을 찾을 수 없습니다');
      form.templateId = dto.templateId;
      form.template = template;
    } else if (dto.isActive === true) {
      const currentTemplate = form.template ?? (await this.templateRepo.findOne({ where: { id: form.templateId } }));
      if (!currentTemplate || currentTemplate.deletedAt) {
        throw new ConflictException('템플릿이 삭제된 폼은 다시 활성화할 수 없습니다');
      }
    }
    if (dto.name !== undefined) form.name = dto.name;
    if (dto.successMessage !== undefined) form.successMessage = dto.successMessage;
    if (dto.isActive !== undefined) form.isActive = dto.isActive;
    return this.formRepo.save(form);
  }

  toResponse(form: Form): FormResponse {
    return toFormResponse(form, this.publicBaseUrl);
  }
}
