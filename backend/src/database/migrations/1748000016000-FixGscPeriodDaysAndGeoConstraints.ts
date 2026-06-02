import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixGscPeriodDaysAndGeoConstraints1748000016000
  implements MigrationInterface
{
  async up(qr: QueryRunner): Promise<void> {
    // 1. Adiciona period_days em gsc_snapshots (estava faltando — causa de toda sync falhar)
    await qr.query(`
      ALTER TABLE crm.gsc_snapshots
        ADD COLUMN IF NOT EXISTS period_days INTEGER NOT NULL DEFAULT 30;
    `);

    // 2. UNIQUE em gsc_snapshots para o ON CONFLICT funcionar
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_gsc_snapshots_client_date_period'
        ) THEN
          ALTER TABLE crm.gsc_snapshots
            ADD CONSTRAINT uq_gsc_snapshots_client_date_period
            UNIQUE (client_id, date, period_days);
        END IF;
      END $$;
    `);

    // 3. UNIQUE em ai_visibility_scores para o ON CONFLICT funcionar
    await qr.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_ai_visibility_scores_client_platform_date'
        ) THEN
          ALTER TABLE crm.ai_visibility_scores
            ADD CONSTRAINT uq_ai_visibility_scores_client_platform_date
            UNIQUE (client_id, platform_id, score_date);
        END IF;
      END $$;
    `);

    // 4. Adiciona last_run_at e last_result em ai_queries para o frontend mostrar
    //    quais prompts foram analisados e se o cliente foi encontrado ou não
    await qr.query(`
      ALTER TABLE crm.ai_queries
        ADD COLUMN IF NOT EXISTS last_run_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_result  BOOLEAN;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(
      `ALTER TABLE crm.ai_queries DROP COLUMN IF EXISTS last_result, DROP COLUMN IF EXISTS last_run_at;`,
    );
    await qr.query(`
      ALTER TABLE crm.ai_visibility_scores
        DROP CONSTRAINT IF EXISTS uq_ai_visibility_scores_client_platform_date;
    `);
    await qr.query(`
      ALTER TABLE crm.gsc_snapshots
        DROP CONSTRAINT IF EXISTS uq_gsc_snapshots_client_date_period;
    `);
    await qr.query(
      `ALTER TABLE crm.gsc_snapshots DROP COLUMN IF EXISTS period_days;`,
    );
  }
}
