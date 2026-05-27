import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileUrlToBlogAuthors1748000014000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm.blog_authors ADD COLUMN IF NOT EXISTS profile_url TEXT`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE crm.blog_authors DROP COLUMN IF EXISTS profile_url`,
    );
  }
}
