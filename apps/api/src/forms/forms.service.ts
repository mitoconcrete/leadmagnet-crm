import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const template = await this.templateRepo.findOne({ where: { id: dto.templateId } });
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
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Form> {
    const found = await this.formRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('폼을 찾을 수 없습니다');
    return found;
  }

  async findOneWithLinks(id: string): Promise<Form> {
    const found = await this.formRepo.findOne({ where: { id }, relations: ['links'] });
    if (!found) throw new NotFoundException('폼을 찾을 수 없습니다');
    return found;
  }

  async update(id: string, dto: UpdateFormDto): Promise<Form> {
    const form = await this.findOne(id);
    if (dto.templateId) {
      const template = await this.templateRepo.findOne({ where: { id: dto.templateId } });
      if (!template) throw new NotFoundException('템플릿을 찾을 수 없습니다');
      form.templateId = dto.templateId;
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
