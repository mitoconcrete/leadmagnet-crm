import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Form } from './form.entity';
import { CHANNELS, Channel } from './channel';

@Entity('distribution_links')
@Unique(['formId', 'channel'])
export class DistributionLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Form, (f) => f.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form!: Form;

  @Column()
  formId!: string;

  @Column({ type: 'enum', enum: CHANNELS, enumName: 'channel' })
  channel!: Channel;

  @Column({ length: 12, unique: true })
  code!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
