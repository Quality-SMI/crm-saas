import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClarityProjectIdToClients1748000005000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE crm.clients
        ADD COLUMN IF NOT EXISTS clarity_project_id TEXT;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE crm.clients DROP COLUMN IF EXISTS clarity_project_id;`);
  }
}
