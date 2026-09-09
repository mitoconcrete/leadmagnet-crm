import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

/** ADR 0019 개정: 캠페인 목록 행. forms(전체 폼 수)·activeForms(활성 폼 수)를 포함한다. */
export interface CampaignListItem extends Omit<Campaign, 'forms'> {
  forms: number;
  activeForms: number;
}

interface CampaignListRawRow {
  id: string;
  name: string;
  description: string | null;
  status: Campaign['status'];
  createdAt: Date;
  updatedAt: Date;
  forms: string | number;
  activeForms: string | number;
}

/** ADR 0019 개정: 캠페인 소속 폼·방문·신청 수. 삭제 가능 여부 판단과 409 details에 쓰인다. */
export interface CampaignEventCounts {
  forms: number;
  visits: number;
  submissions: number;
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

  /**
   * ADR 0019 개정: 캠페인 목록에 forms(전체)·activeForms(활성) 폼 수를 함께 준다.
   * ADR 0017 N+1 상한(캠페인 목록 1쿼리)을 유지하기 위해 forms를 LEFT JOIN해
   * COUNT DISTINCT / FILTER로 단일 QueryBuilder 쿼리에서 집계한다.
   */
  async findAll(): Promise<CampaignListItem[]> {
    const rows = await this.campaignRepo
      .createQueryBuilder('c')
      .leftJoin('forms', 'f', 'f.campaign_id = c.id')
      .select([
        'c.id AS id',
        'c.name AS name',
        'c.description AS description',
        'c.status AS status',
        'c.created_at AS "createdAt"',
        'c.updated_at AS "updatedAt"',
        'COUNT(DISTINCT f.id)::int AS forms',
        'COUNT(DISTINCT f.id) FILTER (WHERE f.is_active)::int AS "activeForms"',
      ])
      .groupBy('c.id')
      .orderBy('c.created_at', 'DESC')
      .getRawMany<CampaignListRawRow>();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      forms: Number(row.forms),
      activeForms: Number(row.activeForms),
    }));
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

  /**
   * ADR 0017: 소속 폼 수·방문 수·신청 수를 단일 집계 쿼리로 센다(템플릿 삭제의
   * countReferences와 같은 패턴). 삭제 가능 여부 판단과 409 details에 쓴다.
   */
  private async countCampaignEvents(id: string): Promise<CampaignEventCounts> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM forms WHERE campaign_id = $1)::int AS forms,
         (SELECT COUNT(*) FROM visits v JOIN forms f ON f.id = v.form_id WHERE f.campaign_id = $1)::int AS visits,
         (SELECT COUNT(*) FROM submissions s JOIN forms f ON f.id = s.form_id WHERE f.campaign_id = $1)::int AS submissions`,
      [id],
    );
    return { forms: Number(row.forms), visits: Number(row.visits), submissions: Number(row.submissions) };
  }

  /**
   * ADR 0019(개정): 소속 폼의 방문·신청이 모두 0건일 때만 삭제를 허용한다. 종료(archived)
   * 여부는 무관하다. 1건이라도 있으면 409 + details(forms, visits, submissions)를 던진다.
   * 삭제는 트랜잭션 안에서 배포 링크 → 폼 → 캠페인 순으로 한다.
   */
  async remove(id: string): Promise<void> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('캠페인을 찾을 수 없습니다');

    const counts = await this.countCampaignEvents(id);
    if (counts.visits > 0 || counts.submissions > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: '이벤트가 있는 캠페인은 삭제할 수 없습니다. 종료(보관)하세요',
        error: 'Conflict',
        details: counts,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM distribution_links WHERE form_id IN (SELECT id FROM forms WHERE campaign_id = $1)`, [
        id,
      ]);
      await manager.query(`DELETE FROM forms WHERE campaign_id = $1`, [id]);
      await manager.getRepository(Campaign).delete(id);
    });
  }
}
