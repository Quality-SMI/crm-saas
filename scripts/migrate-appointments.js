/**
 * Sprint 4: schema da Agenda.
 * - Adiciona colunas website e legacy_id em crm.leads
 * - Cria tabela crm.lead_appointments
 * Idempotente — usa IF NOT EXISTS / DO $$ em tudo.
 */

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5430/postgres';

const steps = [
  {
    label: 'alter leads: add website column',
    sql: `ALTER TABLE crm.leads ADD COLUMN IF NOT EXISTS website TEXT`,
  },
  {
    label: 'alter leads: add legacy_id column',
    sql: `ALTER TABLE crm.leads ADD COLUMN IF NOT EXISTS legacy_id TEXT`,
  },
  {
    label: 'alter leads: unique constraint on legacy_id',
    sql: `
      DO $$ BEGIN
        ALTER TABLE crm.leads ADD CONSTRAINT uq_leads_legacy_id UNIQUE (legacy_id);
      EXCEPTION WHEN duplicate_table THEN null;
               WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: 'enum crm.appointment_status',
    sql: `
      DO $$ BEGIN
        CREATE TYPE crm.appointment_status AS ENUM ('PENDING', 'DONE', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: 'create: crm.lead_appointments',
    sql: `
      CREATE TABLE IF NOT EXISTS crm.lead_appointments (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id          UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
        scheduled_at     TIMESTAMPTZ NOT NULL,
        scheduled_by_id  UUID REFERENCES iam.users(id) ON DELETE SET NULL,
        assigned_to_id   UUID REFERENCES iam.users(id) ON DELETE SET NULL,
        status           crm.appointment_status NOT NULL DEFAULT 'PENDING',
        notes            TEXT,
        meet_link        TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    label: 'idx: appointments assigned_to + scheduled_at',
    sql: `CREATE INDEX IF NOT EXISTS idx_appointments_assigned ON crm.lead_appointments (assigned_to_id, scheduled_at)`,
  },
  {
    label: 'idx: appointments lead_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_appointments_lead ON crm.lead_appointments (lead_id)`,
  },
  {
    label: 'idx: appointments status',
    sql: `CREATE INDEX IF NOT EXISTS idx_appointments_status ON crm.lead_appointments (status)`,
  },
];

async function run() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Conectado ao banco\n');

  let ok = 0, fail = 0;
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
