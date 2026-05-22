import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1748000009000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1748000009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS iam.password_reset_tokens (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID NOT NULL,
        token_hash    VARCHAR(64) NOT NULL,
        expires_at    TIMESTAMPTZ NOT NULL,
        used_at       TIMESTAMPTZ,
        requested_ip  VARCHAR(64),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_password_reset_user
          FOREIGN KEY (user_id) REFERENCES iam.users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token_hash ON iam.password_reset_tokens (token_hash)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_password_reset_user ON iam.password_reset_tokens (user_id, expires_at DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS iam.password_reset_tokens`);
  }
}
