import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('html_templates')
export class HtmlTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  originalFilename!: string;

  @Column({ type: 'text' })
  html!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
