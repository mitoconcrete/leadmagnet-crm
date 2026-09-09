import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from '../entities/form.entity';
import { Visitor } from '../entities/visitor.entity';
import { Visit } from '../entities/visit.entity';
import { Submission } from '../entities/submission.entity';
import { DistributionLink } from '../entities/distribution-link.entity';
import { isUuid } from '../common/uuid';

export interface RecordVisitOptions {
  slug: string;
  src?: string;
  visitorId?: string;
  userAgent?: string;
}

export interface SubmitDto {
  visitToken: string;
  fields: Record<string, unknown>;
}

function isValidFieldValue(value: unknown): value is string | string[] {
  if (typeof value === 'string') return true;
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: unknown })?.code ?? (error as { driverError?: { code?: unknown } })?.driverError?.code;
  return code === UNIQUE_VIOLATION_CODE;
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Form) private readonly formRepo: Repository<Form>,
    @InjectRepository(Visitor) private readonly visitorRepo: Repository<Visitor>,
    @InjectRepository(Visit) private readonly visitRepo: Repository<Visit>,
    @InjectRepository(Submission) private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(DistributionLink) private readonly linkRepo: Repository<DistributionLink>,
  ) {}

  private async findActiveForm(slug: string): Promise<Form> {
    const form = await this.formRepo.findOne({ where: { slug }, relations: ['template'] });
    if (!form || !form.isActive) throw new NotFoundException('폼을 찾을 수 없습니다');
    return form;
  }

  async recordVisit(opts: RecordVisitOptions): Promise<{ form: Form; visit: Visit; visitor: Visitor }> {
    const form = await this.findActiveForm(opts.slug);

    let visitor: Visitor | null = null;
    if (opts.visitorId && isUuid(opts.visitorId)) {
      visitor = await this.visitorRepo.findOne({ where: { id: opts.visitorId } });
    }
    const now = new Date();
    if (visitor) {
      visitor.lastSeenAt = now;
      visitor = await this.visitorRepo.save(visitor);
    } else {
      visitor = await this.visitorRepo.save(this.visitorRepo.create({ lastSeenAt: now }));
    }

    let linkId: string | null = null;
    let channel = 'direct';
    if (opts.src) {
      const link = await this.linkRepo.findOne({ where: { code: opts.src } });
      if (link && link.formId === form.id) {
        linkId = link.id;
        channel = link.channel;
      }
    }

    const visit = await this.visitRepo.save(
      this.visitRepo.create({
        formId: form.id,
        visitorId: visitor.id,
        linkId,
        channel,
        userAgent: opts.userAgent ?? null,
      }),
    );

    return { form, visit, visitor };
  }

  async submit(slug: string, dto: SubmitDto): Promise<{ id: string; message: string }> {
    const form = await this.findActiveForm(slug);

    if (!dto.fields || typeof dto.fields !== 'object' || Array.isArray(dto.fields) || Object.keys(dto.fields).length === 0) {
      throw new BadRequestException('제출 내용이 비어 있습니다');
    }

    if (!Object.values(dto.fields).every(isValidFieldValue)) {
      throw new BadRequestException('제출 값은 문자열 또는 문자열 배열이어야 합니다');
    }

    const visit = await this.visitRepo.findOne({ where: { id: dto.visitToken } });
    if (!visit || visit.formId !== form.id) {
      throw new BadRequestException('유효하지 않은 방문 정보입니다');
    }

    const existing = await this.submissionRepo.findOne({ where: { visitId: visit.id } });
    if (existing) {
      throw new ConflictException('이미 제출된 방문입니다');
    }

    let submission: Submission;
    try {
      submission = await this.submissionRepo.save(
        this.submissionRepo.create({
          formId: form.id,
          visitId: visit.id,
          visitorId: visit.visitorId,
          linkId: visit.linkId,
          channel: visit.channel,
          payload: dto.fields,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('이미 제출된 방문입니다');
      }
      throw error;
    }

    return { id: submission.id, message: form.successMessage };
  }
}
