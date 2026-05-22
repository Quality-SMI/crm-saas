-- =============================================================================
-- AUDITORIA CRM-SAAS: Backend NestJS vs PostgreSQL
-- Gerado em: 2026-05-20
-- =============================================================================
-- RESULTADO DA AUDITORIA:
--   * Todas as colunas definidas nas entidades NestJS JÁ EXISTEM no banco.
--   * O banco possui colunas extras (adicionadas diretamente) não mapeadas nas entidades.
--   * O banco possui 14 tabelas sem entidade NestJS correspondente (módulos futuros).
--   * O enum billing_type no banco (MONTHLY, QUARTERLY, ANNUAL, ONE_TIME) diverge
--     da entidade (MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL).
-- =============================================================================

-- =============================================================================
-- SEÇÃO 1: CORREÇÃO DE ENUM — billing_type
-- Adiciona SEMIANNUAL (está no entity mas falta no DB)
-- Remove ONE_TIME não é possível sem recriar, mas adicionar é seguro
-- =============================================================================

DO $$
BEGIN
  -- Adiciona SEMIANNUAL ao enum billing_type se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'crm' AND t.typname = 'billing_type' AND e.enumlabel = 'SEMIANNUAL'
  ) THEN
    ALTER TYPE crm.billing_type ADD VALUE 'SEMIANNUAL' AFTER 'QUARTERLY';
    RAISE NOTICE 'Added SEMIANNUAL to crm.billing_type';
  ELSE
    RAISE NOTICE 'crm.billing_type.SEMIANNUAL already exists — skipped';
  END IF;
END;
$$;

-- =============================================================================
-- SEÇÃO 2: COLUNAS PRESENTES NO BANCO MAS AUSENTES NAS ENTIDADES
-- (Colunas extras no DB — documentadas para referência e eventual mapeamento)
-- Nenhuma ação necessária: o banco já está à frente das entidades aqui.
-- =============================================================================
-- crm.clients:
--   hosting_subtype_id UUID (referencia crm.hosting_subtypes)
--   ga4_property_id    VARCHAR
--   gsc_site_url       VARCHAR
--
-- crm.segments:
--   created_by  UUID
--   created_at  TIMESTAMPTZ
--   updated_at  TIMESTAMPTZ
--   deleted_at  TIMESTAMPTZ
--
-- crm.service_types:
--   description TEXT
--   is_active   BOOLEAN
--   created_at  TIMESTAMPTZ
--
-- crm.service_subtypes:
--   description TEXT
--   is_active   BOOLEAN
--   created_at  TIMESTAMPTZ
--
-- crm.hosting_types / market_segments / business_models / tags:
--   created_at  TIMESTAMPTZ
--
-- crm.company_sizes:
--   sort_order  INTEGER
--   created_at  TIMESTAMPTZ
-- =============================================================================

-- =============================================================================
-- SEÇÃO 3: TABELAS NO BANCO SEM ENTIDADE NESTJS
-- (Módulos futuros — já criados no banco, falta implementação no backend)
-- As tabelas abaixo existem no banco mas não possuem *.entity.ts:
--   crm.agenda_events
--   crm.blog_pages
--   crm.blogs
--   crm.briefings
--   crm.client_contracted_services
--   crm.client_panels
--   crm.content
--   crm.email_templates
--   crm.financial_records
--   crm.hosting_subtypes
--   crm.keywords
--   crm.lead_origins
--   crm.positioning_records
--   crm.token_controls
-- =============================================================================
-- Nenhum CREATE TABLE necessário para essas — já existem no banco.
-- =============================================================================

-- =============================================================================
-- SEÇÃO 4: ÍNDICES RECOMENDADOS PARA TABELAS QUE AINDA NÃO OS POSSUEM
-- (Baseado nas relações FK definidas nas entidades NestJS)
-- =============================================================================

-- crm.ai_competitor_rankings — índices auxiliares
CREATE INDEX IF NOT EXISTS idx_ai_comp_rankings_client
  ON crm.ai_competitor_rankings (client_id);

CREATE INDEX IF NOT EXISTS idx_ai_comp_rankings_competitor
  ON crm.ai_competitor_rankings (competitor_id);

CREATE INDEX IF NOT EXISTS idx_ai_comp_rankings_platform
  ON crm.ai_competitor_rankings (platform_id);

CREATE INDEX IF NOT EXISTS idx_ai_comp_rankings_checked
  ON crm.ai_competitor_rankings (checked_at DESC);

-- crm.ai_competitors
CREATE INDEX IF NOT EXISTS idx_ai_competitors_client
  ON crm.ai_competitors (client_id);

-- crm.ai_mentions
CREATE INDEX IF NOT EXISTS idx_ai_mentions_client
  ON crm.ai_mentions (client_id);

CREATE INDEX IF NOT EXISTS idx_ai_mentions_platform
  ON crm.ai_mentions (platform_id);

CREATE INDEX IF NOT EXISTS idx_ai_mentions_checked
  ON crm.ai_mentions (checked_at DESC);

-- crm.ai_queries
CREATE INDEX IF NOT EXISTS idx_ai_queries_client
  ON crm.ai_queries (client_id);

-- crm.ai_sources
-- unique index já existe: (client_id, domain)

-- crm.ai_visibility_scores
-- unique index já existe: (client_id, platform_id, score_date)
CREATE INDEX IF NOT EXISTS idx_ai_vis_scores_client
  ON crm.ai_visibility_scores (client_id, score_date DESC);

-- crm.lead_appointments — índices já existem

-- crm.lead_interactions — índice já existe

-- crm.client_emails
CREATE INDEX IF NOT EXISTS idx_client_emails_client
  ON crm.client_emails (client_id);

-- crm.client_phones
CREATE INDEX IF NOT EXISTS idx_client_phones_client
  ON crm.client_phones (client_id);

-- crm.service_subtypes
CREATE INDEX IF NOT EXISTS idx_service_subtypes_type
  ON crm.service_subtypes (service_type_id);

-- =============================================================================
-- SEÇÃO 5: VERIFICAÇÃO FINAL
-- Confirma que o enum foi atualizado corretamente
-- =============================================================================
DO $$
DECLARE
  v_labels TEXT;
BEGIN
  SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
  INTO v_labels
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'crm' AND t.typname = 'billing_type';
  RAISE NOTICE 'crm.billing_type final values: %', v_labels;
END;
$$;

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
-- RESUMO DAS AÇÕES:
--   1. ALTER TYPE crm.billing_type ADD VALUE 'SEMIANNUAL'  (1 enum value)
--   2. CREATE INDEX IF NOT EXISTS (10 índices auxiliares)
-- =============================================================================
