/**
 * Sprint 5 — Dynamic Permission Management
 * Creates: iam.user_permissions
 * Stores per-user permission overrides on top of role defaults
 */

require('dotenv').config({ path: '../backend/.env' });
const { Client } = require('pg');

const pg = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await pg.connect();
  console.log('Connected to database');

  try {
    await pg.query('BEGIN');

    await pg.query(`
      CREATE TABLE IF NOT EXISTS iam.user_permissions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
        permission  VARCHAR(100) NOT NULL,
        granted     BOOLEAN NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, permission)
      )
    `);
    console.log('✓ iam.user_permissions');

    await pg.query(`
      CREATE INDEX IF NOT EXISTS idx_user_permissions_user
        ON iam.user_permissions(user_id)
    `);
    console.log('✓ Indexes');

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
