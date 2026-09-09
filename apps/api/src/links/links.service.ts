import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DistributionLink } from '../entities/distribution-link.entity';
import { Form } from '../entities/form.entity';
import { Channel } from '../entities/channel';
import { generateCode } from '../common/code';
import { PUBLIC_BASE_URL } from '../common/tokens';
import { LinkResponse, toLinkResponse } from './link-response';

const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(DistributionLink) private readonly linkRepo: Repository<DistributionLink>,
    @InjectRepository(Form) private readonly formRepo: Repository<Form>,
    @Inject(PUBLIC_BASE_URL) private readonly publicBaseUrl: string,
  ) {}

  async create(formId: string, channel: Channel): Promise<DistributionLink> {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('폼을 찾을 수 없습니다');

    const existing = await this.linkRepo.findOne({ where: { formId, channel } });
    if (existing) throw new ConflictException('이미 해당 채널의 배포 링크가 있습니다');

    let code = '';
    let found = false;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      code = generateCode();
      const dup = await this.linkRepo.findOne({ where: { code } });
      if (!dup) {
        found = true;
        break;
      }
    }
    if (!found) throw new ConflictException('배포 코드를 생성하지 못했습니다');

    return this.linkRepo.save(this.linkRepo.create({ formId, channel, code }));
  }

  findByForm(formId: string): Promise<DistributionLink[]> {
    return this.linkRepo.find({ where: { formId }, order: { createdAt: 'ASC' } });
  }

  findByCode(code: string): Promise<DistributionLink | null> {
    return this.linkRepo.findOne({ where: { code } });
  }

  toResponse(link: DistributionLink, form: Pick<Form, 'slug'>): LinkResponse {
    return toLinkResponse(link, form, this.publicBaseUrl);
  }
}
