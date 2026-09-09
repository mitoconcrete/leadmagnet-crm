import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('visits')
@Index(['formId'])
@Index(['linkId'])
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  formId!: string;

  @Column()
  visitorId!: string;

  @Column({ type: 'uuid', nullable: true })
  linkId!: string | null;

  @Column({ length: 16 })
  channel!: string;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
