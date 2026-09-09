import { DistributionLink } from '../entities/distribution-link.entity';
import { Form } from '../entities/form.entity';

export interface LinkResponse {
  id: string;
  formId: string;
  channel: string;
  code: string;
  url: string;
  createdAt: Date;
}

export function toLinkResponse(link: DistributionLink, form: Pick<Form, 'slug'>, publicBaseUrl: string): LinkResponse {
  return {
    id: link.id,
    formId: link.formId,
    channel: link.channel,
    code: link.code,
    url: `${publicBaseUrl}/p/${form.slug}?src=${link.code}`,
    createdAt: link.createdAt,
  };
}
