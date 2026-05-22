import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIAMSchema1716134400000 implements MigrationInterface {
  name = 'CreateIAMSchema1716134400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // Schemas
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS iam`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS crm`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS analytics`);

    // Enum: user role
    await queryRunner.query(`
      CREATE TYPE iam.user_role AS ENUM (
        'SUPER_ADMIN', 'DIRECTOR', 'MANAGER',
        'FINANCIAL', 'TECHNICAL', 'WRITER', 'SALES', 'CLIENT_PORTAL'
      )
    `);

    // Table: iam.users
    await queryRunner.query(`
      CREATE TABLE iam.users (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            TEXT NOT NULL,
        email           TEXT NOT NULL,
        password_hash   TEXT NOT NULL,
        role            iam.user_role NOT NULL DEFAULT 'SALES',
        is_active       BOOLEAN NOT NULL DEFAULT true,
        client_id       UUID,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until    TIMESTAMPTZ,
        last_login_at   TIMESTAMPTZ,
        avatar_url      TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT uq_users_email UNIQUE (email)
      )
    `);

    // Table: iam.sessions
    await queryRunner.query(`
      CREATE TABLE iam.sessions (
        id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id               UUID NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
        refresh_token_hash    TEXT NOT NULL,
        token_family          TEXT,
        is_active             BOOLEAN NOT NULL DEFAULT true,
        revoked_at            TIMESTAMPTZ,
        revoke_reason         TEXT,
        ip_address            TEXT,
        user_agent            TEXT,
        expires_at            TIMESTAMPTZ NOT NULL,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Table: iam.login_attempts (audit)
    await queryRunner.query(`
      CREATE TABLE iam.login_attempts (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email       TEXT NOT NULL,
        ip_address  TEXT,
        success     BOOLEAN NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Table: iam.audit_logs (partitioned by month)
    await queryRunner.query(`
      CREATE TABLE iam.audit_logs (
        id            UUID NOT NULL DEFAULT uuid_generate_v4(),
        user_id       UUID,
        action        TEXT NOT NULL,
        resource      TEXT,
        resource_id   TEXT,
        old_values    JSONB,
        new_values    JSONB,
        ip_address    TEXT,
        user_agent    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ) PARTITION BY RANGE (created_at)
    `);

    // First partition (current month)
    await queryRunner.query(`
      CREATE TABLE iam.audit_logs_2026_05
        PARTITION OF iam.audit_logs
        FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_users_email ON iam.users (email)`);
    await queryRunner.query(`CREATE INDEX idx_users_role ON iam.users (role) WHERE deleted_at IS NULL`);
    await queryRunner.query(`CREATE INDEX idx_users_client_id ON iam.users (client_id) WHERE client_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_sessions_user_id ON iam.sessions (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_token_hash ON iam.sessions (refresh_token_hash)`);
    await queryRunner.query(`CREATE INDEX idx_sessions_active ON iam.sessions (user_id, is_active) WHERE is_active = true`);
    await queryRunner.query(`CREATE INDEX idx_audit_user ON iam.audit_logs (user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_audit_action ON iam.audit_logs (action, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_login_attempts_email ON iam.login_attempts (email, created_at DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS iam.audit_logs_2026_05`);
    await queryRunner.query(`DROP TABLE IF EXISTS iam.audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS iam.login_attempts`);
    await queryRunner.query(`DROP TABLE IF EXISTS iam.sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS iam.users`);
    await queryRunner.query(`DROP TYPE IF EXISTS iam.user_role`);
  }
}
