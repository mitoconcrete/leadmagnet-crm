import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Campaign } from '../entities/campaign.entity';
import { Form } from '../entities/form.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { toFormResponse, FormResponse } from '../forms/forms.service';
import { PUBLIC_BASE_URL } from '../common/tokens';

export interface CampaignWithForms extends Omit<Campaign, 'forms'> {
  forms: FormResponse[];
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Form) private readonly formRepo: Repository<Form>,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  create(dto: CreateCampaignDto): Promise<Campaign> {
    return this.campaignRepo.save(
      this.campaignRepo.create({ name: dto.name, description: dto.description ?? null }),
    );
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** ADR 0017: stats 조회용 존재 확인. 폼까지 조회하는 findOneWithForms보다 가볍다(쿼리 1개). */
  async ensureExists(id: string): Promise<void> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('캠페인을 찾을 수 없습니다');
  }

  async findOneWithForms(id: string): Promise<CampaignWithForms> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('캠페인을 찾을 수 없습니다');
    const forms = await this.formRepo.find({ where: { campaignId: id }, order: { createdAt: 'DESC' } });
    return { ...campaign, forms: forms.map((f) => toFormResponse(f, this.publicBaseUrl)) };
  }

  /**
   * ADR 0019: status가 'archived'로 "바뀌는" 경우에만 트랜잭션 안에서 캠페인 갱신 +
   * 소속 폼 전부 isActive=false를 함께 한다. 'active' 재개나 동일 상태 PATCH는
   * 단일 update(캠페인만)이므로 트랜잭션을 쓰지 않는다(ADR 0017: 단일 쓰기는 트랜잭션 불필요).
   */
  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('캠페인을 찾을 수 없습니다');

    const archiving = dto.status === 'archived' && campaign.status !== 'archived';

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.description !== undefined) campaign.description = dto.description;
    if (dto.status !== undefined) campaign.status = dto.status;

    if (archiving) {
      return this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(Campaign).save(campaign);
        await manager.getRepository(Form).update({ campaignId: id }, { isActive: false });
        return saved;
      });
    }

    return this.campaignRepo.save(campaign);
  }
}
