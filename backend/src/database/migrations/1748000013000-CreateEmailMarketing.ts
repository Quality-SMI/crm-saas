import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailMarketing1748000013000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS crm.email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        preview_text TEXT,
        html_body TEXT NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'custom',
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS crm.email_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        preview_text TEXT,
        html_body TEXT NOT NULL,
        from_name TEXT NOT NULL DEFAULT 'Quality SMI',
        from_email TEXT NOT NULL,
        reply_to TEXT,
        audience_type VARCHAR(50) NOT NULL DEFAULT 'all_clients',
        audience_filters JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        total_recipients INT NOT NULL DEFAULT 0,
        sent_count INT NOT NULL DEFAULT 0,
        open_count INT NOT NULL DEFAULT 0,
        click_count INT NOT NULL DEFAULT 0,
        bounce_count INT NOT NULL DEFAULT 0,
        unsubscribe_count INT NOT NULL DEFAULT 0,
        template_id UUID,
        created_by UUID,
        attachments JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS crm.email_campaign_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        recipient_type VARCHAR(20) NOT NULL DEFAULT 'client',
        recipient_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        sent_at TIMESTAMPTZ,
        opened_at TIMESTAMPTZ,
        clicked_at TIMESTAMPTZ,
        bounce_reason TEXT,
        resend_message_id VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crm.email_unsubscribes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        campaign_id UUID,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON crm.email_campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_deleted_at ON crm.email_campaigns(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_id ON crm.email_campaign_recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_status ON crm.email_campaign_recipients(status);
      CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email ON crm.email_unsubscribes(email);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS crm.email_unsubscribes;
      DROP TABLE IF EXISTS crm.email_campaign_recipients;
      DROP TABLE IF EXISTS crm.email_campaigns;
      DROP TABLE IF EXISTS crm.email_templates;
    `);
  }
}
