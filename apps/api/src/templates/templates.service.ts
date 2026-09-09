import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HtmlTemplate } from '../entities/html-template.entity';
import { validateHtmlUpload, UploadedHtmlFile } from './html-validation';

@Injectable()
export class TemplatesService {
  constructor(@InjectRepository(HtmlTemplate) private readonly repo: Repository<HtmlTemplate>) {}

  async create(file: UploadedHtmlFile, name?: string): Promise<HtmlTemplate> {
    validateHtmlUpload(file);
    const resolvedName = name && name.trim().length > 0 ? name : file.originalname.replace(/\.html$/i, '');
    return this.repo.save(
      this.repo.create({
        name: resolvedName,
        originalFilename: file.originalname,
        html: file.buffer.toString('utf-8'),
        sizeBytes: file.size,
      }),
    );
  }

  findAll(): Promise<HtmlTemplate[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<HtmlTemplate> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('템플릿을 찾을 수 없습니다');
    return found;
  }
}
