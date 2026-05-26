import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserPermissionsAndFixAiSources1748000012000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    // Tabela de permissões por usuário (overrides sobre o role padrão)
    await qr.query(`
      CREATE TABLE IF NOT EXISTS iam.user_permissions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
        permission  VARCHAR(100) NOT NULL,
        granted     BOOLEAN NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_user_permissions_user_perm UNIQUE (user_id, permission)
      );
    `);

    await qr.query(
      `CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON iam.user_permissions (user_id);`,
    );

    // Adiciona UNIQUE constraint faltante em ai_sources para o ON CONFLICT funcionar
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_ai_sources_client_domain'
        ) THEN
          ALTER TABLE crm.ai_sources
            ADD CONSTRAINT uq_ai_sources_client_domain UNIQUE (client_id, domain);
        END IF;
      END $$;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS iam.user_permissions;`);
    await qr.query(
      `ALTER TABLE crm.ai_sources DROP CONSTRAINT IF EXISTS uq_ai_sources_client_domain;`,
    );
  }
}
