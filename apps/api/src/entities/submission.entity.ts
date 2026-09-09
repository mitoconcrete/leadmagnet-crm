import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('submissions')
@Index(['formId'])
@Index(['createdAt'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  formId!: string;

  @Column()
  visitId!: string;

  @Column()
  visitorId!: string;

  @Column({ type: 'uuid', nullable: true })
  linkId!: string | null;

  @Column({ length: 16 })
  channel!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
