import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePositioningMonthlyReports1748000011000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS crm.positioning_monthly_reports (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id     UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        report_month  DATE NOT NULL,

        curr_clicks      INT     NOT NULL DEFAULT 0,
        curr_impressions INT     NOT NULL DEFAULT 0,
        curr_position    NUMERIC(6,2),
        curr_ctr         NUMERIC(6,4),
        curr_sessions    INT     NOT NULL DEFAULT 0,

        prev_clicks      INT     NOT NULL DEFAULT 0,
        prev_impressions INT     NOT NULL DEFAULT 0,
        prev_position    NUMERIC(6,2),
        prev_ctr         NUMERIC(6,4),
        prev_sessions    INT     NOT NULL DEFAULT 0,

        keyword_changes  JSONB   NOT NULL DEFAULT '[]',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_positioning_monthly_reports_client_month UNIQUE (client_id, report_month)
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_pmr_client_id ON crm.positioning_monthly_reports (client_id);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS crm.positioning_monthly_reports;`);
  }
}
