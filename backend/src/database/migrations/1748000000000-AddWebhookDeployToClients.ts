import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookDeployToClients1748000000000 implements MigrationInterface {
  name = 'AddWebhookDeployToClients1748000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE crm.clients
      ADD COLUMN IF NOT EXISTS webhook_deploy TEXT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE crm.clients DROP COLUMN IF EXISTS webhook_deploy`);
  }
}
