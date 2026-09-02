#!/usr/bin/env node
/**
 * Applies db/schema.sql to the Neon database named by DATABASE_URL.
 *
 * DATABASE_URL is read from .env.local and used only here -- it is never
 * imported by the backend, never bundled into the frontend, and never set as a
 * Vercel environment variable. The deployed application reaches Postgres only
 * through the Data API, where RLS applies.
 *
 * This script deliberately never prints the connection string, and sanitises
 * driver errors, which sometimes embed it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Minimal .env.local parser -- avoids pulling dotenv into the runtime path.
function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(root, '.env.local'), 'utf8');
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const connectionString = env.DATABASE_URL;

if (!connectionString) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'Copy it from the Neon console (Connection Details) into .env.local as:\n' +
      '  DATABASE_URL="postgresql://..."'
  );
  process.exit(1);
}

// Strip anything resembling the connection string out of error output.
function scrub(message) {
  return String(message).replaceAll(connectionString, '[DATABASE_URL redacted]');
}

const sql = readFileSync(join(root, 'db', 'schema.sql'), 'utf8');
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  console.log('Connected. Applying db/schema.sql ...');
  await client.query(sql);
  console.log('Schema applied.\n');

  const { rows: policies } = await client.query(
    `select policyname, cmd from pg_policies
     where tablename = 'contacts' order by policyname`
  );
  const { rows: rls } = await client.query(
    `select relrowsecurity from pg_class where relname = 'contacts'`
  );
  const { rows: cols } = await client.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_name = 'contacts' order by ordinal_position`
  );

  console.log(`RLS enabled on contacts: ${rls[0]?.relrowsecurity === true}`);
  console.log(`Policies (${policies.length}):`);
  for (const p of policies) console.log(`  - ${p.policyname.padEnd(22)} ${p.cmd}`);
  console.log('\nColumns:');
  for (const c of cols) {
    const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const def = c.column_default ? ` default ${c.column_default}` : '';
    console.log(`  - ${c.column_name.padEnd(12)} ${c.data_type.padEnd(26)} ${nullable}${def}`);
  }
} catch (error) {
  console.error('\nMigration failed:', scrub(error.message));
  if (String(error.message).includes('auth.user_id')) {
    console.error(
      '\nHint: auth.user_id() does not exist yet. Enable the Neon Data API on\n' +
        'this branch first -- that is what creates the auth schema and the\n' +
        '`authenticated` role.'
    );
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
