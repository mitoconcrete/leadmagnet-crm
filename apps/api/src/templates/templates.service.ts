import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { HtmlTemplate } from '../entities/html-template.entity';
import { Form } from '../entities/form.entity';
import { validateHtmlUpload, UploadedHtmlFile } from './html-validation';
import { lintHtmlTemplate } from './html-lint';

/** 저장된 템플릿 엔티티에 등록 시점 점검 경고(ADR 0018)를 얹은 결과. DB에는 저장하지 않는다. */
export type CreatedHtmlTemplate = HtmlTemplate & { warnings: string[] };

interface ReferenceCounts {
  forms: number;
  visits: number;
  submissions: number;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(HtmlTemplate) private readonly repo: Repository<HtmlTemplate>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(file: UploadedHtmlFile, name?: string): Promise<CreatedHtmlTemplate> {
    validateHtmlUpload(file);
    const resolvedName = name && name.trim().length > 0 ? name : file.originalname.replace(/\.html$/i, '');
    const html = file.buffer.toString('utf-8');
    const saved = await this.repo.save(
      this.repo.create({
        name: resolvedName,
        originalFilename: file.originalname,
        html,
        sizeBytes: file.size,
      }),
    );
    // 등록은 그대로 성공한다(ADR 0018 "점검은 안내, 격리는 방어"). warnings는 DB에 저장하지 않고
    // 이 응답에만 실어 보낸다.
    return Object.assign(saved, { warnings: lintHtmlTemplate(html) });
  }

  findAll(): Promise<HtmlTemplate[]> {
    return this.repo.find({ where: { deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<HtmlTemplate> {
    const found = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!found) throw new NotFoundException('템플릿을 찾을 수 없습니다');
    return found;
  }

  /**
   * 템플릿을 참조하는 폼 수·방문 수·신청 수를 단일 집계 쿼리로 센다(ADR 0017 N+1 방지).
   */
  private async countReferences(templateId: string): Promise<ReferenceCounts> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM forms WHERE template_id = $1)::int AS forms,
         (SELECT COUNT(*) FROM visits v JOIN forms f ON f.id = v.form_id WHERE f.template_id = $1)::int AS visits,
         (SELECT COUNT(*) FROM submissions s JOIN forms f ON f.id = s.form_id WHERE f.template_id = $1)::int AS submissions`,
      [templateId],
    );
    return { forms: Number(row.forms), visits: Number(row.visits), submissions: Number(row.submissions) };
  }

  /**
   * ADR 0014(개정): 참조하는 폼이 없으면 hard delete, 있으면 force 없이는 409(details 포함),
   * force면 트랜잭션 안에서 템플릿 소프트 삭제 + 참조 폼 전부 비활성화.
   */
  async remove(id: string, force: boolean): Promise<void> {
    const template = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!template) throw new NotFoundException('템플릿을 찾을 수 없습니다');

    const counts = await this.countReferences(id);

    if (counts.forms === 0) {
      await this.repo.delete(id);
      return;
    }

    if (!force) {
      throw new ConflictException({
        statusCode: 409,
        message: `사용 중인 템플릿입니다(폼 ${counts.forms}개, 방문 ${counts.visits}건, 신청 ${counts.submissions}건)`,
        error: 'Conflict',
        details: counts,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(HtmlTemplate, id, { deletedAt: new Date() });
      await manager.update(Form, { templateId: id }, { isActive: false });
    });
  }
}
