import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * ADR 0014 보완: is_active와 무관하게 template.deletedAt이 있으면 404다(심층 방어).
   * 관리자 서비스가 소프트 삭제 시 폼을 비활성화하지만, DB를 직접 건드려 is_active를
   * true로 되돌려도 이 조회는 여전히 막는다.
   */
  private async findActiveForm(slug: string): Promise<Form> {
    const form = await this.formRepo.findOne({ where: { slug }, relations: ['template'] });
    if (!form || !form.isActive || form.template?.deletedAt) {
      throw new NotFoundException('폼을 찾을 수 없습니다');
    }
    return form;
  }

  /**
   * ADR 0017: visitor 생성/last_seen_at 갱신 + visit insert를 한 트랜잭션으로 묶는다.
   * form 조회와 링크(src) 조회는 순수 읽기이므로 트랜잭션 밖에서 수행한다.
   */
  async recordVisit(opts: RecordVisitOptions): Promise<{ form: Form; visit: Visit; visitor: Visitor }> {
    const form = await this.findActiveForm(opts.slug);

    let linkId: string | null = null;
    let channel = 'direct';
    if (opts.src) {
      const link = await this.linkRepo.findOne({ where: { code: opts.src } });
      if (link && link.formId === form.id) {
        linkId = link.id;
        channel = link.channel;
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const visitorRepo = manager.getRepository(Visitor);
      const visitRepo = manager.getRepository(Visit);

      let visitor: Visitor | null = null;
      if (opts.visitorId && isUuid(opts.visitorId)) {
        visitor = await visitorRepo.findOne({ where: { id: opts.visitorId } });
      }
      const now = new Date();
      if (visitor) {
        visitor.lastSeenAt = now;
        visitor = await visitorRepo.save(visitor);
      } else {
        visitor = await visitorRepo.save(visitorRepo.create({ lastSeenAt: now }));
      }

      const visit = await visitRepo.save(
        visitRepo.create({
          formId: form.id,
          visitorId: visitor.id,
          linkId,
          channel,
          userAgent: opts.userAgent ?? null,
        }),
      );

      return { form, visit, visitor };
    });
  }

  /**
   * ADR 0017: visit 검증 + 중복 확인 + submission insert를 한 트랜잭션으로 묶는다.
   * UNIQUE(visit_id)가 최후 방어이며 위반 시 409로 변환한다.
   */
  async submit(slug: string, dto: SubmitDto): Promise<{ id: string; message: string }> {
    const form = await this.findActiveForm(slug);

    if (!dto.fields || typeof dto.fields !== 'object' || Array.isArray(dto.fields) || Object.keys(dto.fields).length === 0) {
      throw new BadRequestException('제출 내용이 비어 있습니다');
    }

    if (!Object.values(dto.fields).every(isValidFieldValue)) {
      throw new BadRequestException('제출 값은 문자열 또는 문자열 배열이어야 합니다');
    }

    return this.dataSource.transaction(async (manager) => {
      const visitRepo = manager.getRepository(Visit);
      const submissionRepo = manager.getRepository(Submission);

      const visit = await visitRepo.findOne({ where: { id: dto.visitToken } });
      if (!visit || visit.formId !== form.id) {
        throw new BadRequestException('유효하지 않은 방문 정보입니다');
      }

      const existing = await submissionRepo.findOne({ where: { visitId: visit.id } });
      if (existing) {
        throw new ConflictException('이미 제출된 방문입니다');
      }

      let submission: Submission;
      try {
        submission = await submissionRepo.save(
          submissionRepo.create({
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
    });
  }
}
