import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGeoMetadataToAiMentions1748000006000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE crm.ai_mentions
        ADD COLUMN IF NOT EXISTS geo_metadata JSONB;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE crm.ai_mentions DROP COLUMN IF EXISTS geo_metadata;`,
    );
  }
}
