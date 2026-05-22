import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientApiKeys1748000001000 implements MigrationInterface {
  name = 'CreateClientApiKeys1748000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE crm.client_api_keys (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        key         TEXT NOT NULL,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        CONSTRAINT uq_client_api_key UNIQUE (key)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_client_api_keys_client ON crm.client_api_keys(client_id)`);
    await queryRunner.query(`CREATE INDEX idx_client_api_keys_key ON crm.client_api_keys(key) WHERE deleted_at IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_api_keys`);
  }
}
