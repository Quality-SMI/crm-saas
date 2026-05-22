import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClientScores1748000003000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE IF NOT EXISTS crm.client_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        score NUMERIC(5,2) NOT NULL DEFAULT 0,
        score_access NUMERIC(5,2) NOT NULL DEFAULT 0,
        score_clicks NUMERIC(5,2) NOT NULL DEFAULT 0,
        score_positioning NUMERIC(5,2) NOT NULL DEFAULT 0,
        score_indexation NUMERIC(5,2) NOT NULL DEFAULT 0,
        metadata JSONB,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_client_scores_client_calc
        ON crm.client_scores (client_id, calculated_at DESC);
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE IF EXISTS crm.client_scores;`);
  }
}
