/**
 * Sprint 5 — Service Management Refactoring
 * - Deduplicates service_types
 * - Adds code column to service_types
 * - Seeds canonical service types (SEO, Google Ads, Meta Ads, Blog, Website, PR)
 * - Creates crm.client_services table for per-service contracts
 */

require('dotenv').config({ path: '../backend/.env' });
const { Client } = require('pg');

const pg = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pg.connect();
  console.log('Connected');

  try {
    await pg.query('BEGIN');

    // ── 1. Deduplicate service_types ─────────────────────────────────────────
    // Keep lowest-sorted UUID per name, update client refs, delete dupes
    const dupes = await pg.query(`
      SELECT name, array_agg(id ORDER BY id) AS ids
      FROM crm.service_types
      GROUP BY name
      HAVING count(*) > 1
    `);

    for (const row of dupes.rows) {
      const [keep, ...remove] = row.ids;
      if (remove.length) {
        await pg.query(
          `UPDATE crm.clients SET service_type_id = $1 WHERE service_type_id = ANY($2::uuid[])`,
          [keep, remove],
        );
        await pg.query(`DELETE FROM crm.service_types WHERE id = ANY($1::uuid[])`, [remove]);
        console.log(`  deduped "${row.name}" — kept ${keep}, removed ${remove.length}`);
      }
    }

    // ── 2. Add code column ────────────────────────────────────────────────────
    await pg.query(`
      ALTER TABLE crm.service_types
        ADD COLUMN IF NOT EXISTS code VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 99
    `);
    await pg.query(`
      DO $$ BEGIN
        ALTER TABLE crm.service_types ADD CONSTRAINT uq_service_types_code UNIQUE (code);
      EXCEPTION WHEN duplicate_table THEN NULL;
      WHEN others THEN NULL;
      END $$
    `);
    console.log('✓ code + sort_order columns added');

    // ── 3. Upsert canonical service types ─────────────────────────────────────
    const canonical = [
      { name: 'SEO',        code: 'SEO',        sort_order: 1 },
      { name: 'Blog',       code: 'BLOG',       sort_order: 2 },
      { name: 'Google Ads', code: 'GOOGLE_ADS', sort_order: 3 },
      { name: 'Meta Ads',   code: 'META_ADS',   sort_order: 4 },
      { name: 'Website',    code: 'WEBSITE',    sort_order: 5 },
      { name: 'PR',         code: 'PR',         sort_order: 6 },
    ];

    for (const svc of canonical) {
      // Try to update existing row by name first, else insert
      const existing = await pg.query(
        `SELECT id FROM crm.service_types WHERE name = $1`,
        [svc.name],
      );
      if (existing.rows.length) {
        await pg.query(
          `UPDATE crm.service_types SET code = $1, sort_order = $2 WHERE name = $3`,
          [svc.code, svc.sort_order, svc.name],
        );
        console.log(`  updated "${svc.name}" → code=${svc.code}`);
      } else {
        await pg.query(
          `INSERT INTO crm.service_types (name, code, sort_order) VALUES ($1, $2, $3)`,
          [svc.name, svc.code, svc.sort_order],
        );
        console.log(`  inserted "${svc.name}" → code=${svc.code}`);
      }
    }

    // ── 4. Create client_services table ──────────────────────────────────────
    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.client_services (
        id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id         UUID    NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        service_type_id   UUID    NOT NULL REFERENCES crm.service_types(id),
        status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        -- Contract duration
        contract_months   INTEGER,
        -- Financial — separated for analytics
        management_fee    NUMERIC(10,2),  -- agency revenue (Ads services)
        media_budget      NUMERIC(10,2),  -- client's ad spend (Ads services)
        monthly_value     NUMERIC(10,2),  -- recurring revenue (SEO, PR, etc.)
        one_time_value    NUMERIC(10,2),  -- project price (Website)
        -- Tracking
        renewal_count     INTEGER NOT NULL DEFAULT 0,
        started_at        DATE,
        -- Service-specific extras (keywords_qty, contracted_pages, etc.)
        config            JSONB   NOT NULL DEFAULT '{}',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ crm.client_services');

    await pg.query(`CREATE INDEX IF NOT EXISTS idx_client_services_client   ON crm.client_services(client_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_client_services_type     ON crm.client_services(service_type_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_client_services_status   ON crm.client_services(status)`);
    console.log('✓ indexes');

    await pg.query('COMMIT');
    console.log('\nMigration completed successfully.');
  } catch (err) {
    await pg.query('ROLLBACK');
    console.error('Failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    await pg.end();
  }
}

run();
