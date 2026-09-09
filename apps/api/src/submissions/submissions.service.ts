import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';

export interface ListSubmissionsOptions {
  campaignId?: string;
  formId?: string;
  page?: number;
  limit?: number;
}

export interface SubmissionListItem {
  id: string;
  formId: string;
  formName: string;
  campaignId: string;
  channel: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface SubmissionListResult {
  items: SubmissionListItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SubmissionsService {
  constructor(@InjectRepository(Submission) private readonly repo: Repository<Submission>) {}

  async list(opts: ListSubmissionsOptions): Promise<SubmissionListResult> {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 20;

    const baseQb = () => {
      const qb = this.repo
        .createQueryBuilder('s')
        .innerJoin('forms', 'f', 'f.id = s.form_id');
      if (opts.campaignId) qb.andWhere('f.campaign_id = :campaignId', { campaignId: opts.campaignId });
      if (opts.formId) qb.andWhere('s.form_id = :formId', { formId: opts.formId });
      return qb;
    };

    const total = await baseQb().getCount();

    const rows = await baseQb()
      .select([
        's.id AS id',
        's.form_id AS "formId"',
        'f.name AS "formName"',
        'f.campaign_id AS "campaignId"',
        's.channel AS channel',
        's.payload AS payload',
        's.created_at AS "createdAt"',
      ])
      .orderBy('s.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<SubmissionListItem>();

    return { items: rows, total, page, limit };
  }
}
