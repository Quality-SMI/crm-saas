const { Client } = require('pg');

const DB = {
  host: '145.79.7.208',
  port: 5430,
  database: 'postgres',
  user: 'postgres',
  password: 'HJ2sYplU3G2FvPvVct7u2saWKNkEjb0yrGsLz9am5v6d1w062OmulMkOgqaAz0H8',
  connectionTimeoutMillis: 15000,
};

// Cada item do array é executado como uma query independente
const STEPS = [
  // ── Extensões
  { label: 'uuid-ossp', sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` },
  { label: 'pg_trgm',   sql: `CREATE EXTENSION IF NOT EXISTS "pg_trgm"` },

  // ── Schemas
  { label: 'schema iam',       sql: `CREATE SCHEMA IF NOT EXISTS iam` },
  { label: 'schema crm',       sql: `CREATE SCHEMA IF NOT EXISTS crm` },
  { label: 'schema analytics', sql: `CREATE SCHEMA IF NOT EXISTS analytics` },

  // ── Enums
  { label: 'enum iam.user_role', sql: `
    DO $$ BEGIN
      CREATE TYPE iam.user_role AS ENUM (
        'SUPER_ADMIN','DIRECTOR','MANAGER',
        'FINANCIAL','TECHNICAL','WRITER','SALES','CLIENT_PORTAL'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.client_status', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.client_status AS ENUM ('ACTIVE','PAUSED','FINISHED','CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.lead_status', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.lead_status AS ENUM ('LEAD','DELEGATION','PROPOSAL','NEGOTIATION','CLOSED','LOST');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.briefing_status', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.briefing_status AS ENUM ('CREATED','FIRST_ACCESS','FIRST_SEND','APPROVED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.financial_status', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.financial_status AS ENUM ('UP_TO_DATE','OVERDUE','LEGAL','CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.content_status', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.content_status AS ENUM ('PENDING','IN_PROGRESS','REVIEW','APPROVED','PUBLISHED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },
  { label: 'enum crm.billing_type', sql: `
    DO $$ BEGIN
      CREATE TYPE crm.billing_type AS ENUM ('MONTHLY','QUARTERLY','ANNUAL','ONE_TIME');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$` },

  // ── IAM
  { label: 'iam.users', sql: `
    CREATE TABLE IF NOT EXISTS iam.users (
      id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name                  TEXT NOT NULL,
      email                 TEXT NOT NULL,
      password_hash         TEXT NOT NULL,
      role                  iam.user_role NOT NULL DEFAULT 'SALES',
      is_active             BOOLEAN NOT NULL DEFAULT true,
      client_id             UUID,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until          TIMESTAMPTZ,
      last_login_at         TIMESTAMPTZ,
      avatar_url            TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at            TIMESTAMPTZ,
      CONSTRAINT uq_iam_users_email UNIQUE (email)
    )` },
  { label: 'iam.sessions', sql: `
    CREATE TABLE IF NOT EXISTS iam.sessions (
      id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id             UUID NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
      refresh_token_hash  TEXT NOT NULL,
      token_family        TEXT,
      is_active           BOOLEAN NOT NULL DEFAULT true,
      revoked_at          TIMESTAMPTZ,
      revoke_reason       TEXT,
      ip_address          TEXT,
      user_agent          TEXT,
      expires_at          TIMESTAMPTZ NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'iam.login_attempts', sql: `
    CREATE TABLE IF NOT EXISTS iam.login_attempts (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email       TEXT NOT NULL,
      ip_address  TEXT,
      success     BOOLEAN NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'iam.audit_logs (partitioned)', sql: `
    CREATE TABLE IF NOT EXISTS iam.audit_logs (
      id           UUID NOT NULL DEFAULT uuid_generate_v4(),
      user_id      UUID,
      action       TEXT NOT NULL,
      resource     TEXT,
      resource_id  TEXT,
      old_values   JSONB,
      new_values   JSONB,
      ip_address   TEXT,
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ) PARTITION BY RANGE (created_at)` },
  ...[
    ['2026_05','2026-05-01','2026-06-01'],
    ['2026_06','2026-06-01','2026-07-01'],
    ['2026_07','2026-07-01','2026-08-01'],
    ['2026_08','2026-08-01','2026-09-01'],
    ['2026_09','2026-09-01','2026-10-01'],
    ['2026_10','2026-10-01','2026-11-01'],
    ['2026_11','2026-11-01','2026-12-01'],
    ['2026_12','2026-12-01','2027-01-01'],
    ['2027_01','2027-01-01','2027-02-01'],
    ['2027_02','2027-02-01','2027-03-01'],
    ['2027_03','2027-03-01','2027-04-01'],
    ['2027_04','2027-04-01','2027-05-01'],
    ['2027_05','2027-05-01','2027-06-01'],
    ['2027_06','2027-06-01','2027-07-01'],
    ['2027_07','2027-07-01','2027-08-01'],
    ['2027_08','2027-08-01','2027-09-01'],
    ['2027_09','2027-09-01','2027-10-01'],
    ['2027_10','2027-10-01','2027-11-01'],
    ['2027_11','2027-11-01','2027-12-01'],
    ['2027_12','2027-12-01','2028-01-01'],
  ].map(([s,f,t]) => ({
    label: `partition audit_logs_${s}`,
    sql: `CREATE TABLE IF NOT EXISTS iam.audit_logs_${s} PARTITION OF iam.audit_logs FOR VALUES FROM ('${f}') TO ('${t}')`
  })),

  // ── CRM Lookup
  { label: 'crm.segments', sql: `
    CREATE TABLE IF NOT EXISTS crm.segments (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      created_by  UUID REFERENCES iam.users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    )` },
  { label: 'crm.service_types', sql: `
    CREATE TABLE IF NOT EXISTS crm.service_types (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      description TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.service_subtypes', sql: `
    CREATE TABLE IF NOT EXISTS crm.service_subtypes (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      service_type_id UUID NOT NULL REFERENCES crm.service_types(id),
      name            TEXT NOT NULL,
      is_active       BOOLEAN NOT NULL DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.hosting_types', sql: `
    CREATE TABLE IF NOT EXISTS crm.hosting_types (
      id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.hosting_subtypes', sql: `
    CREATE TABLE IF NOT EXISTS crm.hosting_subtypes (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      hosting_type_id UUID NOT NULL REFERENCES crm.hosting_types(id),
      name            TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.lead_origins', sql: `
    CREATE TABLE IF NOT EXISTS crm.lead_origins (
      id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name  TEXT NOT NULL
    )` },
  { label: 'crm.email_templates', sql: `
    CREATE TABLE IF NOT EXISTS crm.email_templates (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      variables   JSONB DEFAULT '[]',
      created_by  UUID REFERENCES iam.users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    )` },

  // ── Clientes
  { label: 'crm.clients', sql: `
    CREATE TABLE IF NOT EXISTS crm.clients (
      id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_name           TEXT NOT NULL,
      legal_name             TEXT,
      cnpj                   TEXT,
      domain                 TEXT NOT NULL,
      contact_name           TEXT,
      segment_id             UUID REFERENCES crm.segments(id),
      seller_id              UUID REFERENCES iam.users(id),
      technical_id           UUID REFERENCES iam.users(id),
      writer_id              UUID REFERENCES iam.users(id),
      status                 crm.client_status NOT NULL DEFAULT 'ACTIVE',
      service_type_id        UUID REFERENCES crm.service_types(id),
      service_subtype_id     UUID REFERENCES crm.service_subtypes(id),
      contract_keywords_qty  INTEGER,
      contracted_at          DATE,
      monthly_value          NUMERIC(10,2),
      billing_type           crm.billing_type DEFAULT 'MONTHLY',
      first_payment_date     DATE,
      due_day                SMALLINT,
      installments_qty       SMALLINT,
      hosting_type_id        UUID REFERENCES crm.hosting_types(id),
      hosting_subtype_id     UUID REFERENCES crm.hosting_subtypes(id),
      zip_code               TEXT,
      street                 TEXT,
      street_number          TEXT,
      neighborhood           TEXT,
      city                   TEXT,
      state                  CHAR(2),
      notes                  TEXT,
      legacy_id              TEXT,
      created_by             UUID REFERENCES iam.users(id),
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at             TIMESTAMPTZ
    )` },
  { label: 'crm.client_emails', sql: `
    CREATE TABLE IF NOT EXISTS crm.client_emails (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      label       TEXT,
      is_primary  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.client_phones', sql: `
    CREATE TABLE IF NOT EXISTS crm.client_phones (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      phone       TEXT NOT NULL,
      label       TEXT,
      is_primary  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'crm.client_contracted_services', sql: `
    CREATE TABLE IF NOT EXISTS crm.client_contracted_services (
      id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id          UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      service_type_id    UUID REFERENCES crm.service_types(id),
      service_subtype_id UUID REFERENCES crm.service_subtypes(id),
      notes              TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Leads
  { label: 'crm.leads', sql: `
    CREATE TABLE IF NOT EXISTS crm.leads (
      id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_name           TEXT NOT NULL,
      domain                 TEXT,
      contact_name           TEXT,
      email                  TEXT,
      phone_1                TEXT,
      phone_2                TEXT,
      status                 crm.lead_status NOT NULL DEFAULT 'LEAD',
      origin_id              UUID REFERENCES crm.lead_origins(id),
      responsible_id         UUID REFERENCES iam.users(id),
      creator_id             UUID REFERENCES iam.users(id),
      notes                  TEXT,
      ai_score               SMALLINT,
      ai_score_reason        TEXT,
      ai_scored_at           TIMESTAMPTZ,
      converted_to_client_id UUID REFERENCES crm.clients(id),
      converted_at           TIMESTAMPTZ,
      lost_reason            TEXT,
      legacy_id              TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at             TIMESTAMPTZ
    )` },
  { label: 'crm.lead_occurrences', sql: `
    CREATE TABLE IF NOT EXISTS crm.lead_occurrences (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      lead_id         UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
      user_id         UUID REFERENCES iam.users(id),
      description     TEXT NOT NULL,
      next_contact_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Briefings
  { label: 'crm.briefings', sql: `
    CREATE TABLE IF NOT EXISTS crm.briefings (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id       UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      status          crm.briefing_status NOT NULL DEFAULT 'CREATED',
      content         JSONB DEFAULT '{}',
      created_by      UUID REFERENCES iam.users(id),
      first_access_at TIMESTAMPTZ,
      first_send_at   TIMESTAMPTZ,
      approved_at     TIMESTAMPTZ,
      notes           TEXT,
      legacy_id       TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Keywords
  { label: 'crm.keywords', sql: `
    CREATE TABLE IF NOT EXISTS crm.keywords (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id     UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      keyword       TEXT NOT NULL,
      is_sold       BOOLEAN NOT NULL DEFAULT true,
      is_contracted BOOLEAN NOT NULL DEFAULT true,
      is_crossword  BOOLEAN NOT NULL DEFAULT false,
      status        TEXT NOT NULL DEFAULT 'ACTIVE',
      position      SMALLINT,
      target_url    TEXT,
      notes         TEXT,
      legacy_id     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    )` },

  // ── Posicionamento
  { label: 'crm.positioning_records', sql: `
    CREATE TABLE IF NOT EXISTS crm.positioning_records (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      keyword_id  UUID REFERENCES crm.keywords(id),
      keyword     TEXT NOT NULL,
      position    SMALLINT,
      url_found   TEXT,
      search_date DATE NOT NULL DEFAULT CURRENT_DATE,
      engine      TEXT NOT NULL DEFAULT 'google',
      device      TEXT NOT NULL DEFAULT 'desktop',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Conteúdo
  { label: 'crm.content', sql: `
    CREATE TABLE IF NOT EXISTS crm.content (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id     UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      url           TEXT,
      content_type  TEXT NOT NULL DEFAULT 'page',
      status        crm.content_status NOT NULL DEFAULT 'PENDING',
      writer_id     UUID REFERENCES iam.users(id),
      reviewer_id   UUID REFERENCES iam.users(id),
      word_count    INTEGER,
      published_at  TIMESTAMPTZ,
      due_date      DATE,
      notes         TEXT,
      legacy_id     TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at    TIMESTAMPTZ
    )` },

  // ── Blogs
  { label: 'crm.blogs', sql: `
    CREATE TABLE IF NOT EXISTS crm.blogs (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID REFERENCES crm.clients(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      domain      TEXT NOT NULL,
      group_name  TEXT,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      legacy_id   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at  TIMESTAMPTZ
    )` },
  { label: 'crm.blog_pages', sql: `
    CREATE TABLE IF NOT EXISTS crm.blog_pages (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      blog_id     UUID NOT NULL REFERENCES crm.blogs(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      url         TEXT,
      status      TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Financeiro
  { label: 'crm.financial_records', sql: `
    CREATE TABLE IF NOT EXISTS crm.financial_records (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id        UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      status           crm.financial_status NOT NULL DEFAULT 'UP_TO_DATE',
      reference_month  DATE NOT NULL,
      amount           NUMERIC(10,2) NOT NULL,
      due_date         DATE,
      paid_at          TIMESTAMPTZ,
      payment_method   TEXT,
      invoice_url      TEXT,
      notes            TEXT,
      legacy_id        TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Token Controls
  { label: 'crm.token_controls', sql: `
    CREATE TABLE IF NOT EXISTS crm.token_controls (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      token_type  TEXT NOT NULL,
      token_value TEXT,
      description TEXT,
      expires_at  TIMESTAMPTZ,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_by  UUID REFERENCES iam.users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Agenda
  { label: 'crm.agenda_events', sql: `
    CREATE TABLE IF NOT EXISTS crm.agenda_events (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title        TEXT NOT NULL,
      description  TEXT,
      starts_at    TIMESTAMPTZ NOT NULL,
      ends_at      TIMESTAMPTZ,
      all_day      BOOLEAN NOT NULL DEFAULT false,
      client_id    UUID REFERENCES crm.clients(id) ON DELETE SET NULL,
      lead_id      UUID REFERENCES crm.leads(id) ON DELETE SET NULL,
      user_id      UUID NOT NULL REFERENCES iam.users(id),
      attendees    JSONB DEFAULT '[]',
      location     TEXT,
      event_type   TEXT NOT NULL DEFAULT 'meeting',
      completed    BOOLEAN NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    )` },

  // ── Portal do cliente (Fase 2 — estrutura já criada)
  { label: 'crm.client_panels', sql: `
    CREATE TABLE IF NOT EXISTS crm.client_panels (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
      panel_type  TEXT NOT NULL DEFAULT 'overview',
      config      JSONB DEFAULT '{}',
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Analytics
  { label: 'analytics.content_production', sql: `
    CREATE TABLE IF NOT EXISTS analytics.content_production (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id     UUID NOT NULL REFERENCES iam.users(id),
      client_id   UUID REFERENCES crm.clients(id),
      content_id  UUID REFERENCES crm.content(id),
      month_ref   DATE NOT NULL,
      quantity    INTEGER NOT NULL DEFAULT 0,
      word_count  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },
  { label: 'analytics.positioning_snapshots', sql: `
    CREATE TABLE IF NOT EXISTS analytics.positioning_snapshots (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id   UUID NOT NULL REFERENCES crm.clients(id),
      month_ref   DATE NOT NULL,
      avg_position NUMERIC(5,2),
      keywords_in_top3  INTEGER DEFAULT 0,
      keywords_in_top10 INTEGER DEFAULT 0,
      keywords_total    INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )` },

  // ── Índices IAM
  { label: 'idx: iam.users email',      sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON iam.users (email)` },
  { label: 'idx: iam.users role',       sql: `CREATE INDEX IF NOT EXISTS idx_users_role ON iam.users (role) WHERE deleted_at IS NULL` },
  { label: 'idx: iam.users client_id',  sql: `CREATE INDEX IF NOT EXISTS idx_users_client_id ON iam.users (client_id) WHERE client_id IS NOT NULL` },
  { label: 'idx: iam.sessions user',    sql: `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON iam.sessions (user_id)` },
  { label: 'idx: iam.sessions token',   sql: `CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON iam.sessions (refresh_token_hash)` },
  { label: 'idx: iam.sessions active',  sql: `CREATE INDEX IF NOT EXISTS idx_sessions_active ON iam.sessions (user_id, is_active) WHERE is_active = true` },
  { label: 'idx: login_attempts',       sql: `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON iam.login_attempts (email, created_at DESC)` },
  { label: 'idx: audit user',           sql: `CREATE INDEX IF NOT EXISTS idx_audit_user ON iam.audit_logs (user_id, created_at DESC)` },
  { label: 'idx: audit action',         sql: `CREATE INDEX IF NOT EXISTS idx_audit_action ON iam.audit_logs (action, created_at DESC)` },

  // ── Índices CRM
  { label: 'idx: clients status',      sql: `CREATE INDEX IF NOT EXISTS idx_clients_status  ON crm.clients (status) WHERE deleted_at IS NULL` },
  { label: 'idx: clients seller',      sql: `CREATE INDEX IF NOT EXISTS idx_clients_seller  ON crm.clients (seller_id) WHERE deleted_at IS NULL` },
  { label: 'idx: clients domain trgm', sql: `CREATE INDEX IF NOT EXISTS idx_clients_domain  ON crm.clients USING gin (domain gin_trgm_ops)` },
  { label: 'idx: clients company trgm',sql: `CREATE INDEX IF NOT EXISTS idx_clients_company ON crm.clients USING gin (company_name gin_trgm_ops)` },
  { label: 'idx: leads status',        sql: `CREATE INDEX IF NOT EXISTS idx_leads_status       ON crm.leads (status) WHERE deleted_at IS NULL` },
  { label: 'idx: leads responsible',   sql: `CREATE INDEX IF NOT EXISTS idx_leads_responsible  ON crm.leads (responsible_id) WHERE deleted_at IS NULL` },
  { label: 'idx: leads company trgm',  sql: `CREATE INDEX IF NOT EXISTS idx_leads_company      ON crm.leads USING gin (company_name gin_trgm_ops)` },
  { label: 'idx: keywords client',     sql: `CREATE INDEX IF NOT EXISTS idx_keywords_client    ON crm.keywords (client_id) WHERE deleted_at IS NULL` },
  { label: 'idx: positioning client',  sql: `CREATE INDEX IF NOT EXISTS idx_positioning_client ON crm.positioning_records (client_id, search_date DESC)` },
  { label: 'idx: positioning date',    sql: `CREATE INDEX IF NOT EXISTS idx_positioning_date   ON crm.positioning_records (search_date DESC)` },
  { label: 'idx: content client',      sql: `CREATE INDEX IF NOT EXISTS idx_content_client     ON crm.content (client_id) WHERE deleted_at IS NULL` },
  { label: 'idx: content writer',      sql: `CREATE INDEX IF NOT EXISTS idx_content_writer     ON crm.content (writer_id) WHERE deleted_at IS NULL` },
  { label: 'idx: content status',      sql: `CREATE INDEX IF NOT EXISTS idx_content_status     ON crm.content (status) WHERE deleted_at IS NULL` },
  { label: 'idx: financial client',    sql: `CREATE INDEX IF NOT EXISTS idx_financial_client   ON crm.financial_records (client_id)` },
  { label: 'idx: financial status',    sql: `CREATE INDEX IF NOT EXISTS idx_financial_status   ON crm.financial_records (status)` },
  { label: 'idx: financial due',       sql: `CREATE INDEX IF NOT EXISTS idx_financial_due      ON crm.financial_records (due_date) WHERE status = 'OVERDUE'` },
  { label: 'idx: agenda user',         sql: `CREATE INDEX IF NOT EXISTS idx_agenda_user        ON crm.agenda_events (user_id, starts_at) WHERE deleted_at IS NULL` },
  { label: 'idx: briefings client',    sql: `CREATE INDEX IF NOT EXISTS idx_briefings_client   ON crm.briefings (client_id)` },
  { label: 'idx: blogs client',        sql: `CREATE INDEX IF NOT EXISTS idx_blogs_client       ON crm.blogs (client_id) WHERE deleted_at IS NULL` },
  { label: 'idx: keywords keyword trgm', sql: `CREATE INDEX IF NOT EXISTS idx_keywords_trgm   ON crm.keywords USING gin (keyword gin_trgm_ops)` },

  // ── Dados iniciais
  { label: 'seed: service_types', sql: `
    INSERT INTO crm.service_types (name) VALUES
      ('Site Completo'), ('SMI'), ('SMI Regionalizado (Produto B)'), ('Somente as Páginas')
    ON CONFLICT DO NOTHING` },
  { label: 'seed: hosting_types', sql: `
    INSERT INTO crm.hosting_types (name) VALUES
      ('Hospedagem Própria'), ('Hospedagem do Cliente'), ('Hospedagem Quality SMI')
    ON CONFLICT DO NOTHING` },
  { label: 'seed: lead_origins', sql: `
    INSERT INTO crm.lead_origins (name) VALUES
      ('Indicação'), ('Google Ads'), ('Site'), ('Instagram'), ('Facebook'),
      ('WhatsApp'), ('LinkedIn'), ('Cold Outreach'), ('Evento'), ('Outro')
    ON CONFLICT DO NOTHING` },
  { label: 'seed: segments', sql: `
    INSERT INTO crm.segments (name) VALUES
      ('Indústria'), ('Comércio'), ('Serviços'), ('Tecnologia'),
      ('Saúde'), ('Educação'), ('Construção'), ('Alimentação'), ('Outro')
    ON CONFLICT DO NOTHING` },
];

async function run() {
  const client = new Client(DB);
  await client.connect();
  console.log('✅ Conectado ao banco de dados\n');

  let ok = 0, skipped = 0, errors = 0;

  for (const step of STEPS) {
    try {
      await client.query(step.sql);
      ok++;
      console.log(`  ✓ ${step.label}`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        skipped++;
        console.log(`  ⏭  ${step.label} (já existe)`);
      } else {
        errors++;
        console.error(`  ✗ ${step.label}: ${e.message.split('\n')[0]}`);
      }
    }
  }

  // Relatório final
  const { rows: tables } = await client.query(`
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('iam','crm','analytics')
    ORDER BY schemaname, tablename
  `);

  const { rows: indexes } = await client.query(`
    SELECT count(*) as total FROM pg_indexes
    WHERE schemaname IN ('iam','crm','analytics')
  `);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 ${ok} OK  |  ${skipped} já existiam  |  ${errors} erros`);
  console.log(`📋 ${tables.length} tabelas  |  ${indexes[0].total} índices\n`);

  let lastSchema = '';
  for (const row of tables) {
    if (row.schemaname !== lastSchema) {
      console.log(`  [${row.schemaname}]`);
      lastSchema = row.schemaname;
    }
    console.log(`    - ${row.tablename}`);
  }

  await client.end();
  if (errors > 0) process.exit(1);
}

run().catch(e => { console.error('\n❌ Falha crítica:', e.message); process.exit(1); });
