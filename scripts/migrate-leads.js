/**
 * Migração: substitui crm.leads e crm.lead_occurrences (schema legado)
 * pelo novo schema usado pelo módulo NestJS de Leads (Sprint 3).
 *
 * Seguro executar em banco de desenvolvimento — tabelas antigas estão vazias.
 */

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5430/postgres';

const steps = [
  // 1. remove dependências antigas
  {
    label: 'drop: crm.lead_occurrences',
    sql: `DROP TABLE IF EXISTS crm.lead_occurrences CASCADE`,
  },
  {
    label: 'drop: crm.leads (legado)',
    sql: `DROP TABLE IF EXISTS crm.leads CASCADE`,
  },
  {
    label: 'drop: enum crm.lead_status (legado)',
    sql: `DROP TYPE IF EXISTS crm.lead_status CASCADE`,
  },

  // 2. novos enums
  {
    label: 'enum crm.lead_stage',
    sql: `
      DO $$ BEGIN
        CREATE TYPE crm.lead_stage AS ENUM ('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST');
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: 'enum crm.lead_origin',
    sql: `
      DO $$ BEGIN
        CREATE TYPE crm.lead_origin AS ENUM ('WEBSITE','REFERRAL','COLD_CALL','SOCIAL_MEDIA','EVENT','OTHER');
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: 'enum crm.interaction_type',
    sql: `
      DO $$ BEGIN
        CREATE TYPE crm.interaction_type AS ENUM ('CALL','EMAIL','MEETING','NOTE','STATUS_CHANGE');
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },

  // 3. nova tabela crm.leads
  {
    label: 'create: crm.leads',
    sql: `
      CREATE TABLE IF NOT EXISTS crm.leads (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name             TEXT NOT NULL,
        contact_name     TEXT,
        contact_email    TEXT,
        contact_phone    VARCHAR(30),
        stage            crm.lead_stage   NOT NULL DEFAULT 'NEW',
        origin           crm.lead_origin,
        estimated_value  NUMERIC(10,2),
        notes            TEXT,
        lost_reason      TEXT,
        owner_id         UUID REFERENCES iam.users(id) ON DELETE SET NULL,
        created_by       UUID REFERENCES iam.users(id) ON DELETE SET NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at       TIMESTAMPTZ
      )`,
  },

  // 4. nova tabela crm.lead_interactions
  {
    label: 'create: crm.lead_interactions',
    sql: `
      CREATE TABLE IF NOT EXISTS crm.lead_interactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id     UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
        user_id     UUID REFERENCES iam.users(id) ON DELETE SET NULL,
        type        crm.interaction_type NOT NULL DEFAULT 'NOTE',
        description TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },

  // 5. índices
  {
    label: 'idx: leads stage',
    sql: `CREATE INDEX IF NOT EXISTS idx_leads_stage    ON crm.leads (stage) WHERE deleted_at IS NULL`,
  },
  {
    label: 'idx: leads owner',
    sql: `CREATE INDEX IF NOT EXISTS idx_leads_owner    ON crm.leads (owner_id) WHERE deleted_at IS NULL`,
  },
  {
    label: 'idx: lead_interactions lead',
    sql: `CREATE INDEX IF NOT EXISTS idx_lead_inter_lead ON crm.lead_interactions (lead_id)`,
  },
];

async function run() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Conectado ao banco de dados\n');

  let ok = 0;
  let fail = 0;

  for (const step of steps) {
    try {
      await client.query(step.sql);
      console.log(`✓ ${step.label}`);
      ok++;
    } catch (err) {
      console.error(`✗ ${step.label}: ${err.message}`);
      fail++;
    }
  }

  await client.end();
  console.log(`\nConcluído: ${ok} ok, ${fail} falhas`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
