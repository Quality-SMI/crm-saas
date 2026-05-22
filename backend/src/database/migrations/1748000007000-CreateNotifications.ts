import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1748000007000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS crm.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        metadata JSONB,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON crm.notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON crm.notifications(created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS crm.idx_notifications_created_at;
      DROP INDEX IF EXISTS crm.idx_notifications_is_read;
      DROP TABLE IF EXISTS crm.notifications;
    `);
  }
}
