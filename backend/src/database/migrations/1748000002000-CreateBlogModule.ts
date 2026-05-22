import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogModule1748000002000 implements MigrationInterface {
  name = 'CreateBlogModule1748000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE crm.blog_authors (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        bio         TEXT,
        avatar_url  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_blog_authors_client ON crm.blog_authors(client_id) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE crm.blog_categories (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        slug        TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_blog_categories_client ON crm.blog_categories(client_id) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE crm.blog_tags (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        slug        TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_blog_tags_client ON crm.blog_tags(client_id) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE crm.blog_articles (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id       UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        author_id       UUID REFERENCES crm.blog_authors(id) ON DELETE SET NULL,
        category_id     UUID REFERENCES crm.blog_categories(id) ON DELETE SET NULL,
        title           TEXT NOT NULL,
        slug            TEXT NOT NULL,
        description     TEXT,
        image           TEXT,
        content         TEXT,
        raw_content     JSONB,
        status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        date_published  TIMESTAMPTZ,
        created_by      UUID,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT uq_blog_article_slug UNIQUE (client_id, slug)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_blog_articles_client ON crm.blog_articles(client_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_blog_articles_status ON crm.blog_articles(client_id, status) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE crm.blog_article_tags (
        article_id  UUID NOT NULL REFERENCES crm.blog_articles(id) ON DELETE CASCADE,
        tag_id      UUID NOT NULL REFERENCES crm.blog_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (article_id, tag_id)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS crm.blog_article_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.blog_articles`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.blog_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.blog_categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.blog_authors`);
  }
}
