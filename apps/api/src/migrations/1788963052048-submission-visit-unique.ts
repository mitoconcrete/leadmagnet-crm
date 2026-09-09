import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubmissionVisitUnique1788963052048 implements MigrationInterface {
  name = 'SubmissionVisitUnique1788963052048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX uq_submissions_visit_id ON submissions(visit_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX uq_submissions_visit_id`);
  }
}
