import { Operator } from './operator.entity';
import { Session } from './session.entity';
import { HtmlTemplate } from './html-template.entity';
import { Campaign } from './campaign.entity';
import { Form } from './form.entity';
import { DistributionLink } from './distribution-link.entity';
import { Visitor } from './visitor.entity';
import { Visit } from './visit.entity';
import { Submission } from './submission.entity';

export { Operator } from './operator.entity';
export { Session } from './session.entity';
export { HtmlTemplate } from './html-template.entity';
export { Campaign } from './campaign.entity';
export { Form } from './form.entity';
export { DistributionLink } from './distribution-link.entity';
export { Visitor } from './visitor.entity';
export { Visit } from './visit.entity';
export { Submission } from './submission.entity';
export * from './channel';

export const entities = [
  Operator,
  Session,
  HtmlTemplate,
  Campaign,
  Form,
  DistributionLink,
  Visitor,
  Visit,
  Submission,
];
