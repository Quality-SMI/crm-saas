/**
 * Sprint 5 — Company Classification Migration
 * Creates: market_segments, business_models, company_sizes, tags, client_tags
 * Adds FK columns on crm.clients
 * Seeds initial lookup data
 */

require('dotenv').config({ path: '../backend/.env' });
const { Client } = require('pg');

const pg = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pg.connect();
  console.log('Connected to database');

  try {
    await pg.query('BEGIN');

    // ── Lookup tables ─────────────────────────────────────────────────────────

    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.market_segments (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ crm.market_segments');

    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.business_models (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ crm.business_models');

    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.company_sizes (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT NOT NULL UNIQUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ crm.company_sizes');

    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.tags (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ crm.tags');

    // ── FK columns on crm.clients ─────────────────────────────────────────────

    await pg.query(`ALTER TABLE crm.clients ADD COLUMN IF NOT EXISTS market_segment_id UUID REFERENCES crm.market_segments(id) ON DELETE SET NULL`);
    await pg.query(`ALTER TABLE crm.clients ADD COLUMN IF NOT EXISTS business_model_id UUID REFERENCES crm.business_models(id) ON DELETE SET NULL`);
    await pg.query(`ALTER TABLE crm.clients ADD COLUMN IF NOT EXISTS company_size_id   UUID REFERENCES crm.company_sizes(id)  ON DELETE SET NULL`);
    console.log('✓ FK columns on crm.clients');

    // ── client_tags pivot ─────────────────────────────────────────────────────

    await pg.query(`
      CREATE TABLE IF NOT EXISTS crm.client_tags (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        tag_id    UUID NOT NULL REFERENCES crm.tags(id)    ON DELETE CASCADE,
        UNIQUE (client_id, tag_id)
      )
    `);
    console.log('✓ crm.client_tags');

    // ── Indexes ───────────────────────────────────────────────────────────────

    await pg.query(`CREATE INDEX IF NOT EXISTS idx_clients_market_segment ON crm.clients(market_segment_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_clients_business_model ON crm.clients(business_model_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_clients_company_size   ON crm.clients(company_size_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_client_tags_client     ON crm.client_tags(client_id)`);
    await pg.query(`CREATE INDEX IF NOT EXISTS idx_client_tags_tag        ON crm.client_tags(tag_id)`);
    console.log('✓ Indexes');

    // ── Seed: Market Segments ─────────────────────────────────────────────────

    const marketSegments = [
      'Industrial',
      'Alimentício',
      'Tecnologia',
      'Saúde',
      'Serviços',
      'Varejo',
      'Construção Civil',
      'Financeiro',
      'Jurídico',
      'Educação',
      'Automotivo',
      'E-commerce',
    ];
    for (const name of marketSegments) {
      await pg.query(
        `INSERT INTO crm.market_segments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name],
      );
    }
    console.log(`✓ Seeded ${marketSegments.length} market segments`);

    // ── Seed: Business Models ─────────────────────────────────────────────────

    const businessModels = ['B2B', 'B2C', 'DTC', 'Marketplace', 'SaaS', 'Internacional', 'Franquia'];
    for (const name of businessModels) {
      await pg.query(
        `INSERT INTO crm.business_models (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name],
      );
    }
    console.log(`✓ Seeded ${businessModels.length} business models`);

    // ── Seed: Company Sizes ───────────────────────────────────────────────────

    const companySizes = [
      { name: 'Silver',  sort_order: 1 },
      { name: 'Gold',    sort_order: 2 },
      { name: 'Diamond', sort_order: 3 },
    ];
    for (const { name, sort_order } of companySizes) {
      await pg.query(
        `INSERT INTO crm.company_sizes (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [name, sort_order],
      );
    }
    console.log(`✓ Seeded ${companySizes.length} company sizes`);

    await pg.query('COMMIT');
    console.log('\nMigration completed successfully.');
  } catch (err) {
    await pg.query('ROLLBACK');
    console.error('Migration failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    await pg.end();
  }
}

run();
