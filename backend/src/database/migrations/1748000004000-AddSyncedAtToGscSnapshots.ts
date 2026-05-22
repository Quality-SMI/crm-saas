import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSyncedAtToGscSnapshots1748000004000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE crm.gsc_snapshots
        ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE crm.gsc_snapshots DROP COLUMN IF EXISTS synced_at;`);
  }
}
