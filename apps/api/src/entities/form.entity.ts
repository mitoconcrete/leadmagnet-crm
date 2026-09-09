import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { HtmlTemplate } from './html-template.entity';
import { DistributionLink } from './distribution-link.entity';

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Campaign, (c) => c.forms)
  @JoinColumn({ name: 'campaign_id' })
  campaign!: Campaign;

  @Column()
  campaignId!: string;

  @ManyToOne(() => HtmlTemplate)
  @JoinColumn({ name: 'template_id' })
  template!: HtmlTemplate;

  @Column()
  templateId!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ default: '신청이 완료되었습니다.' })
  successMessage!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => DistributionLink, (l) => l.form)
  links!: DistributionLink[];
}
