import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('visitors')
export class Visitor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz' })
  lastSeenAt!: Date;
}
