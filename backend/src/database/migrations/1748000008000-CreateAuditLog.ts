import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLog1748000008000 implements MigrationInterface {
  name = 'CreateAuditLog1748000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS iam.audit_log (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID,
        user_email   VARCHAR(320),
        method       VARCHAR(10) NOT NULL,
        path         TEXT NOT NULL,
        status_code  INTEGER NOT NULL,
        ip           VARCHAR(64),
        user_agent   TEXT,
        meta         JSONB,
        duration_ms  INTEGER,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON iam.audit_log (user_id, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_method_path ON iam.audit_log (method, path)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON iam.audit_log (created_at DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS iam.audit_log`);
  }
}
