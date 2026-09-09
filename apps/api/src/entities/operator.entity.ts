import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type OperatorRole = 'admin' | 'operator';

@Entity('operators')
export class Operator {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  /** ADR 0020(부분 채택): admin만 다음 단계에서 운영자 관리 권한을 갖는다. */
  @Column({ type: 'enum', enum: ['admin', 'operator'], enumName: 'operator_role', default: 'operator' })
  role!: OperatorRole;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
