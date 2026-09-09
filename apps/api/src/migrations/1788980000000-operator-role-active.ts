import { MigrationInterface, QueryRunner } from 'typeorm';

/** ADR 0020(부분 채택): 운영자 역할·활성 구조만 추가한다. 운영자 관리 API는 다음 단계. */
export class OperatorRoleActive1788980000000 implements MigrationInterface {
  name = 'OperatorRoleActive1788980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE operator_role AS ENUM ('admin', 'operator')`);
    await queryRunner.query(
      `ALTER TABLE operators
         ADD COLUMN role operator_role NOT NULL DEFAULT 'operator',
         ADD COLUMN is_active boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE operators DROP COLUMN role, DROP COLUMN is_active`);
    await queryRunner.query(`DROP TYPE operator_role`);
  }
}
