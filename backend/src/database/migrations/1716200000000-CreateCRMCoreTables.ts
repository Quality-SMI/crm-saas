import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCRMCoreTables1716200000000 implements MigrationInterface {
  name = 'CreateCRMCoreTables1716200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE crm.client_status AS ENUM (
        'ACTIVE','PAYING','CANCELLED','RENEWED','PAUSED','FINISHED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE crm.billing_type AS ENUM (
        'MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE crm.lead_stage AS ENUM (
        'NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE crm.lead_origin AS ENUM (
        'WEBSITE','REFERRAL','COLD_CALL','SOCIAL_MEDIA','EVENT','OTHER'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE crm.interaction_type AS ENUM (
        'CALL','EMAIL','MEETING','NOTE','STATUS_CHANGE'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE crm.appointment_status AS ENUM (
        'PENDING','DONE','CANCELLED'
      )
    `);

    // ── Lookup tables ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.segments (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.service_types (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(100) NOT NULL,
        code       VARCHAR(50) UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 99
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.service_subtypes (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            VARCHAR(100) NOT NULL,
        service_type_id UUID NOT NULL REFERENCES crm.service_types(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.hosting_types (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.market_segments (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.business_models (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.company_sizes (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.tags (
        id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // ── AI platforms (no FK deps) ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.ai_platforms (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(100) NOT NULL,
        slug       VARCHAR(50) NOT NULL UNIQUE,
        icon_url   TEXT,
        is_active  BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── clients ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.clients (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_name          TEXT NOT NULL,
        legal_name            TEXT,
        cnpj                  TEXT,
        domain                TEXT NOT NULL,
        contact_name          TEXT,
        status                crm.client_status NOT NULL DEFAULT 'ACTIVE',
        segment_id            UUID REFERENCES crm.segments(id),
        seller_id             UUID REFERENCES iam.users(id),
        technical_id          UUID REFERENCES iam.users(id),
        writer_id             UUID REFERENCES iam.users(id),
        service_type_id       UUID REFERENCES crm.service_types(id),
        service_subtype_id    UUID REFERENCES crm.service_subtypes(id),
        contract_keywords_qty INTEGER,
        contracted_at         DATE,
        monthly_value         NUMERIC(10,2),
        billing_type          crm.billing_type DEFAULT 'MONTHLY',
        first_payment_date    DATE,
        due_day               SMALLINT,
        installments_qty      SMALLINT,
        hosting_type_id       UUID REFERENCES crm.hosting_types(id),
        zip_code              VARCHAR(10),
        street                TEXT,
        street_number         VARCHAR(20),
        neighborhood          TEXT,
        city                  TEXT,
        state                 VARCHAR(2),
        contracted_keywords   TEXT[] NOT NULL DEFAULT '{}',
        notes                 TEXT,
        webhook_deploy        TEXT,
        clarity_project_id    TEXT,
        legacy_id             TEXT,
        created_by            UUID REFERENCES iam.users(id),
        market_segment_id     UUID REFERENCES crm.market_segments(id),
        business_model_id     UUID REFERENCES crm.business_models(id),
        company_size_id       UUID REFERENCES crm.company_sizes(id),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_clients_status ON crm.clients(status)`);
    await queryRunner.query(`CREATE INDEX idx_clients_domain ON crm.clients(domain)`);

    // ── client sub-tables ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.client_emails (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id  UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        email      TEXT NOT NULL,
        label      VARCHAR(50),
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.client_phones (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id  UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        phone      TEXT NOT NULL,
        label      VARCHAR(50),
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.client_tags (
        id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        tag_id    UUID NOT NULL REFERENCES crm.tags(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.client_services (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id       UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        service_type_id UUID NOT NULL REFERENCES crm.service_types(id),
        status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        contract_months INTEGER,
        management_fee  NUMERIC(10,2),
        media_budget    NUMERIC(10,2),
        monthly_value   NUMERIC(10,2),
        one_time_value  NUMERIC(10,2),
        renewal_count   INTEGER NOT NULL DEFAULT 0,
        started_at      DATE,
        config          JSONB NOT NULL DEFAULT '{}',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── GSC snapshots ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.gsc_snapshots (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id         UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        date              DATE NOT NULL,
        total_clicks      INTEGER NOT NULL DEFAULT 0,
        total_impressions INTEGER NOT NULL DEFAULT 0,
        avg_position      NUMERIC(6,2),
        avg_ctr           NUMERIC(6,4),
        keywords          JSONB NOT NULL DEFAULT '[]',
        pages             JSONB NOT NULL DEFAULT '[]',
        sessions          INTEGER NOT NULL DEFAULT 0,
        users             INTEGER NOT NULL DEFAULT 0,
        synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_gsc_client_date ON crm.gsc_snapshots(client_id, date)`);

    // ── GEO / AI tables ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.ai_queries (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id    UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        prompt       TEXT NOT NULL,
        category     VARCHAR(100),
        platform_ids JSONB NOT NULL DEFAULT '[]',
        is_active    BOOLEAN NOT NULL DEFAULT true,
        created_by   UUID REFERENCES iam.users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.ai_mentions (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id        UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        platform_id      UUID NOT NULL REFERENCES crm.ai_platforms(id),
        query_id         UUID REFERENCES crm.ai_queries(id),
        mention_type     VARCHAR(50) NOT NULL DEFAULT 'DIRECT',
        response_excerpt TEXT,
        sentiment        VARCHAR(20),
        sentiment_score  NUMERIC(3,2),
        ranking_position INTEGER,
        visibility_impact NUMERIC(5,2),
        urls_cited       JSONB NOT NULL DEFAULT '[]',
        geo_metadata     JSONB,
        checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by       UUID REFERENCES iam.users(id),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_ai_mentions_client ON crm.ai_mentions(client_id, checked_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE crm.ai_sources (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id      UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        domain         VARCHAR(255) NOT NULL,
        citation_count INTEGER NOT NULL DEFAULT 0,
        authority_score NUMERIC(5,2),
        last_seen_at   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.ai_competitors (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id         UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        competitor_name   VARCHAR(255) NOT NULL,
        competitor_domain VARCHAR(255),
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.ai_competitor_rankings (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id        UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        competitor_id    UUID NOT NULL REFERENCES crm.ai_competitors(id) ON DELETE CASCADE,
        platform_id      UUID NOT NULL REFERENCES crm.ai_platforms(id),
        query_id         UUID REFERENCES crm.ai_queries(id),
        ranking_position INTEGER,
        mention_count    INTEGER NOT NULL DEFAULT 0,
        visibility_share NUMERIC(5,2),
        checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.ai_visibility_scores (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id        UUID NOT NULL REFERENCES crm.clients(id) ON DELETE CASCADE,
        platform_id      UUID REFERENCES crm.ai_platforms(id),
        score_date       DATE NOT NULL,
        visibility_score NUMERIC(5,2),
        geo_score        NUMERIC(5,2),
        mention_count    INTEGER NOT NULL DEFAULT 0,
        avg_ranking      NUMERIC(5,2),
        avg_sentiment    NUMERIC(3,2),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Keywords ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.keyword_categories (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id  UUID,
        name       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.client_keywords (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_id   UUID NOT NULL,
        keyword     TEXT NOT NULL,
        slug        TEXT,
        category_id UUID REFERENCES crm.keyword_categories(id),
        is_active   BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_keywords_client ON crm.client_keywords(client_id) WHERE deleted_at IS NULL`);

    // ── Leads ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE crm.leads (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            TEXT NOT NULL,
        contact_name    TEXT,
        contact_email   TEXT,
        contact_phone   VARCHAR(30),
        website         TEXT,
        stage           crm.lead_stage NOT NULL DEFAULT 'NEW',
        origin          crm.lead_origin,
        estimated_value NUMERIC(10,2),
        street          TEXT,
        state           VARCHAR(2),
        notes           TEXT,
        lost_reason     TEXT,
        owner_id        UUID REFERENCES iam.users(id),
        created_by      UUID REFERENCES iam.users(id),
        legacy_id       TEXT UNIQUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_leads_stage ON crm.leads(stage) WHERE deleted_at IS NULL`);

    await queryRunner.query(`
      CREATE TABLE crm.lead_interactions (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id     UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
        user_id     UUID REFERENCES iam.users(id),
        type        crm.interaction_type NOT NULL DEFAULT 'NOTE',
        description TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE crm.lead_appointments (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id          UUID NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
        scheduled_at     TIMESTAMPTZ NOT NULL,
        scheduled_by_id  UUID REFERENCES iam.users(id),
        assigned_to_id   UUID REFERENCES iam.users(id),
        status           crm.appointment_status NOT NULL DEFAULT 'PENDING',
        notes            TEXT,
        duration_minutes INTEGER DEFAULT 60,
        meet_link        TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── Seed lookup data ──────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO crm.segments (name) VALUES
        ('E-commerce'),('Serviços'),('Indústria'),('Saúde'),('Educação'),
        ('Tecnologia'),('Varejo'),('Imobiliário'),('Financeiro'),('Outros')
    `);

    await queryRunner.query(`
      INSERT INTO crm.service_types (name, code, sort_order) VALUES
        ('SEO',                   'SEO',     1),
        ('Google Ads',            'GADS',    2),
        ('Meta Ads',              'MADS',    3),
        ('Desenvolvimento Web',   'WEB',     4),
        ('Criação de Conteúdo',   'CONTENT', 5),
        ('Assessoria de Imprensa','PR',      6),
        ('Consultoria',           'CONSULT', 7)
    `);

    await queryRunner.query(`
      INSERT INTO crm.hosting_types (name) VALUES
        ('Próprio'),('Locaweb'),('HostGator'),('AWS'),('GCP'),('Azure'),('Outro')
    `);

    await queryRunner.query(`
      INSERT INTO crm.market_segments (name) VALUES
        ('B2B'),('B2C'),('B2B2C'),('D2C')
    `);

    await queryRunner.query(`
      INSERT INTO crm.business_models (name) VALUES
        ('Produto'),('Serviço'),('SaaS'),('Marketplace'),('Assinatura'),('Híbrido')
    `);

    await queryRunner.query(`
      INSERT INTO crm.company_sizes (name) VALUES
        ('MEI'),('Micro (até 9 func.)'),('Pequena (10-49)'),('Média (50-249)'),('Grande (250+)')
    `);

    await queryRunner.query(`
      INSERT INTO crm.ai_platforms (name, slug) VALUES
        ('ChatGPT',  'chatgpt'),
        ('Gemini',   'gemini'),
        ('Copilot',  'copilot'),
        ('Perplexity','perplexity'),
        ('Claude',   'claude')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS crm.lead_appointments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.lead_interactions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.leads CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_keywords CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.keyword_categories CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_visibility_scores CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_competitor_rankings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_competitors CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_sources CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_mentions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_queries CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.gsc_snapshots CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_services CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_tags CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_phones CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.client_emails CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.clients CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.ai_platforms CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.tags CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.company_sizes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.business_models CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.market_segments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.hosting_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.service_subtypes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.service_types CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm.segments CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.appointment_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.interaction_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.lead_origin`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.lead_stage`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.billing_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm.client_status`);
  }
}
