import { MigrationInterface, QueryRunner } from 'typeorm';

export class TemplateDeletedAt1788978200000 implements MigrationInterface {
  name = 'TemplateDeletedAt1788978200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE html_templates ADD COLUMN deleted_at timestamptz NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE html_templates DROP COLUMN deleted_at`);
  }
}
