import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1757400000000 implements MigrationInterface {
  name = 'Init1757400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`CREATE TYPE campaign_status AS ENUM ('active','archived')`);
    await queryRunner.query(`CREATE TYPE channel AS ENUM ('instagram','x','youtube','threads')`);
    await queryRunner.query(`CREATE TABLE operators (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar NOT NULL UNIQUE,
      password_hash varchar NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      operator_id uuid NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE html_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar NOT NULL,
      original_filename varchar NOT NULL,
      html text NOT NULL,
      size_bytes int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar NOT NULL,
      description text,
      status campaign_status NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE forms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id uuid NOT NULL REFERENCES campaigns(id),
      template_id uuid NOT NULL REFERENCES html_templates(id),
      name varchar NOT NULL,
      slug varchar NOT NULL UNIQUE,
      success_message varchar NOT NULL DEFAULT '신청이 완료되었습니다.',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE distribution_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      channel channel NOT NULL,
      code varchar(12) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (form_id, channel)
    )`);
    await queryRunner.query(`CREATE TABLE visitors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      form_id uuid NOT NULL REFERENCES forms(id),
      visitor_id uuid NOT NULL REFERENCES visitors(id),
      link_id uuid REFERENCES distribution_links(id) ON DELETE SET NULL,
      channel varchar(16) NOT NULL,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX idx_visits_form_id ON visits(form_id)`);
    await queryRunner.query(`CREATE INDEX idx_visits_link_id ON visits(link_id)`);
    await queryRunner.query(`CREATE TABLE submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      form_id uuid NOT NULL REFERENCES forms(id),
      visit_id uuid NOT NULL REFERENCES visits(id),
      visitor_id uuid NOT NULL REFERENCES visitors(id),
      link_id uuid REFERENCES distribution_links(id) ON DELETE SET NULL,
      channel varchar(16) NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX idx_submissions_form_id ON submissions(form_id)`);
    await queryRunner.query(`CREATE INDEX idx_submissions_created_at ON submissions(created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE submissions`);
    await queryRunner.query(`DROP TABLE visits`);
    await queryRunner.query(`DROP TABLE visitors`);
    await queryRunner.query(`DROP TABLE distribution_links`);
    await queryRunner.query(`DROP TABLE forms`);
    await queryRunner.query(`DROP TABLE campaigns`);
    await queryRunner.query(`DROP TABLE html_templates`);
    await queryRunner.query(`DROP TABLE sessions`);
    await queryRunner.query(`DROP TABLE operators`);
    await queryRunner.query(`DROP TYPE channel`);
    await queryRunner.query(`DROP TYPE campaign_status`);
  }
}
