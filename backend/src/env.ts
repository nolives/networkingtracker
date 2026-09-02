import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads .env.local into process.env for local development only.
 *
 * On Vercel the variables come from the project settings, so this is a no-op
 * there. Existing process.env values always win, so nothing here can override
 * a real deployment configuration.
 *
 * Note that DATABASE_URL is never read by the backend -- it appears in
 * .env.local solely for db/migrate.mjs.
 */
export function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(here, '..', '..');

  let raw: string;
  try {
    raw = readFileSync(join(repoRoot, '.env.local'), 'utf8');
  } catch {
    return;
  }

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

    if (!(key in process.env)) process.env[key] = value;
  }
}
