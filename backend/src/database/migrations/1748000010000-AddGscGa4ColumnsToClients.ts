import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGscGa4ColumnsToClients1748000010000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE crm.clients
        ADD COLUMN IF NOT EXISTS gsc_site_url      TEXT,
        ADD COLUMN IF NOT EXISTS ga4_property_id   TEXT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_clients_gsc_site_url
        ON crm.clients(gsc_site_url) WHERE gsc_site_url IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm.clients DROP COLUMN IF EXISTS gsc_site_url`,
    );
    await queryRunner.query(
      `ALTER TABLE crm.clients DROP COLUMN IF EXISTS ga4_property_id`,
    );
  }
}
