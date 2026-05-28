import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttachmentsToEmailCampaigns1748000015000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm.email_campaigns ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm.email_campaigns DROP COLUMN IF EXISTS attachments`,
    );
  }
}
