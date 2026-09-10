import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR 0014(추가) · 스펙 §4.2 409: 살아 있는(deleted_at IS NULL) 템플릿끼리는 이름이
 * 겹칠 수 없다. 소프트 삭제된 템플릿은 이 인덱스 대상에서 빠지므로 이름을 재사용할 수
 * 있다. 부분 유니크 인덱스라 소프트 삭제된 이름은 여러 개 남아 있어도 무방하다.
 *
 * 주의: 이 마이그레이션은 기존 데이터에 살아 있는 중복 이름이 있으면 실패한다. 별도
 * dedupe는 하지 않는다 — 개발 DB는 `docker compose down -v`로 초기화하는 것이 원칙이다.
 */
export class TemplateNameUnique1788990000000 implements MigrationInterface {
  name = 'TemplateNameUnique1788990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_html_templates_name_alive ON html_templates(name) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX uq_html_templates_name_alive`);
  }
}
