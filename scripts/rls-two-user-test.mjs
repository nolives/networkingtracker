#!/usr/bin/env node
/**
 * Two-account privacy proof.
 *
 * Signs in as two real users and verifies that User A cannot read, modify, or
 * delete User B's contacts -- attacking on two fronts:
 *
 *   1. Through the Node backend  (proves the API layer is scoped correctly)
 *   2. Directly at the public Data API, bypassing the backend entirely
 *      (proves ROW LEVEL SECURITY is what actually stops it -- the backend
 *      could be removed and the data would still be protected)
 *
 * The second is the one that matters. It uses the same public Data API URL
 * that ships in the frontend bundle, with a real signed-in user's real token.
 *
 * Usage: npm run test:rls        (requires .env.local -- see .env.example)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const out = {};
  let raw;
  try {
    raw = readFileSync(join(root, '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };

const AUTH_URL = (env.NEON_AUTH_URL ?? env.VITE_NEON_AUTH_URL ?? '').replace(/\/+$/, '');
const DATA_API_URL = (env.VITE_NEON_DATA_API_URL ?? env.NEON_DATA_API_URL ?? '').replace(/\/+$/, '');
const API_URL = (env.TEST_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

const required = { AUTH_URL, DATA_API_URL };
for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing ${key}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
}

const accounts = {
  A: { email: env.TEST_USER_A_EMAIL, password: env.TEST_USER_A_PASSWORD },
  B: { email: env.TEST_USER_B_EMAIL, password: env.TEST_USER_B_PASSWORD },
};

for (const [label, account] of Object.entries(accounts)) {
  if (!account.email || !account.password) {
    console.error(`Missing TEST_USER_${label}_EMAIL / _PASSWORD in .env.local.`);
    process.exit(1);
  }
}

// --- tiny assertion harness -------------------------------------------------

let passed = 0;
let failed = 0;

function check(description, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${description}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${description}${detail ? `\n        ${detail}` : ''}`);
  }
}

// --- auth -------------------------------------------------------------------

const isJwt = (v) => typeof v === 'string' && v.split('.').length === 3;

function findJwt(value, depth = 0) {
  if (isJwt(value)) return value;
  if (depth > 3 || value === null || typeof value !== 'object') return null;
  for (const nested of Object.values(value)) {
    const found = findJwt(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Signs in against Managed Better Auth and returns the JWT the Data API
 * accepts. Better Auth keeps an opaque session cookie; the JWT is issued
 * separately, so if sign-in does not hand one back we ask /token for it.
 */
async function signIn({ email, password }) {
  const response = await fetch(`${AUTH_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      `Sign-in failed for ${email} (${response.status}): ${await response.text()}`
    );
  }

  const body = await response.json();
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');

  let token = findJwt(body);

  if (!token) {
    const tokenResponse = await fetch(`${AUTH_URL}/token`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body.token ? { Authorization: `Bearer ${body.token}` } : {}),
      },
    });
    if (tokenResponse.ok) token = findJwt(await tokenResponse.json());
  }

  if (!token) throw new Error(`Could not obtain a JWT for ${email}.`);

  const claims = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
  );

  return { token, userId: claims.sub, email };
}

// --- direct Data API calls (no backend involved) ----------------------------

function dataApi(path, token, init = {}) {
  return fetch(`${DATA_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Without this, a write filtered to zero rows returns a bare 204 that
      // is indistinguishable from success.
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
}

async function main() {
  console.log('\nTwo-account RLS privacy test');
  console.log('='.repeat(58));

  const [userA, userB] = await Promise.all([
    signIn(accounts.A),
    signIn(accounts.B),
  ]);

  console.log(`\nUser A: ${userA.email}  (sub ${userA.userId})`);
  console.log(`User B: ${userB.email}  (sub ${userB.userId})`);

  check('the two accounts are distinct', userA.userId !== userB.userId);

  // User B creates a contact that User A must never be able to touch.
  const created = await dataApi('/contacts', userB.token, {
    method: 'POST',
    body: JSON.stringify({
      name: `B-private-${Date.now()}`,
      company: 'User B Confidential',
      priority: 'high',
    }),
  });

  const [secret] = await created.json();

  if (!secret?.id) {
    console.error('\nCould not create a contact as User B. Aborting.');
    process.exit(1);
  }

  console.log(`\nUser B created contact ${secret.id}`);
  check(
    "the row is owned by User B via auth.user_id()",
    secret.user_id === userB.userId,
    `expected ${userB.userId}, got ${secret.user_id}`
  );

  // ---- 1. Direct Data API attacks -----------------------------------------
  console.log('\n1. User A attacks the public Data API directly (no backend):');

  const readAll = await dataApi('/contacts?select=*', userA.token);
  const visible = await readAll.json();
  check(
    "SELECT returns none of User B's rows",
    Array.isArray(visible) && !visible.some((r) => r.id === secret.id),
    `saw ${Array.isArray(visible) ? visible.length : '?'} rows`
  );
  check(
    'every row User A can see is their own',
    Array.isArray(visible) && visible.every((r) => r.user_id === userA.userId)
  );

  const readTargeted = await dataApi(
    `/contacts?select=*&id=eq.${secret.id}`,
    userA.token
  );
  const targeted = await readTargeted.json();
  check(
    "SELECT by exact id returns nothing",
    Array.isArray(targeted) && targeted.length === 0,
    `got ${JSON.stringify(targeted)}`
  );

  const patched = await dataApi(`/contacts?id=eq.${secret.id}`, userA.token, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'HACKED BY A' }),
  });
  const patchedRows = await patched.json().catch(() => []);
  check(
    'UPDATE affects zero rows',
    !Array.isArray(patchedRows) || patchedRows.length === 0,
    `got ${JSON.stringify(patchedRows)}`
  );

  const stolen = await dataApi(`/contacts?id=eq.${secret.id}`, userA.token, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userA.userId }),
  });
  const stolenRows = await stolen.json().catch(() => []);
  check(
    'UPDATE cannot reassign ownership (WITH CHECK)',
    !Array.isArray(stolenRows) || stolenRows.length === 0,
    `got ${JSON.stringify(stolenRows)}`
  );

  const deleted = await dataApi(`/contacts?id=eq.${secret.id}`, userA.token, {
    method: 'DELETE',
  });
  const deletedRows = await deleted.json().catch(() => []);
  check(
    'DELETE affects zero rows',
    !Array.isArray(deletedRows) || deletedRows.length === 0,
    `got ${JSON.stringify(deletedRows)}`
  );

  // ---- 2. Through the backend ---------------------------------------------
  console.log(`\n2. User A attacks through the backend API (${API_URL}):`);

  let backendReachable = true;
  try {
    const health = await fetch(`${API_URL}/api/health`);
    backendReachable = health.ok;
  } catch {
    backendReachable = false;
  }

  if (!backendReachable) {
    console.log(`  SKIP  backend not reachable at ${API_URL}`);
    console.log('        start it with `npm run dev:backend`, or set TEST_API_URL');
  } else {
    const api = (path, init = {}) =>
      fetch(`${API_URL}/api${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${userA.token}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });

    const list = await api('/contacts');
    const { contacts = [] } = await list.json();
    check(
      "GET /contacts excludes User B's rows",
      !contacts.some((c) => c.id === secret.id)
    );

    const getOne = await api(`/contacts/${secret.id}`);
    check('GET by id returns 404', getOne.status === 404, `got ${getOne.status}`);

    const patch = await api(`/contacts/${secret.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'HACKED BY A' }),
    });
    check('PATCH returns 404', patch.status === 404, `got ${patch.status}`);

    const del = await api(`/contacts/${secret.id}`, { method: 'DELETE' });
    check('DELETE returns 404', del.status === 404, `got ${del.status}`);
  }

  // ---- 3. Confirm the row survived untouched ------------------------------
  console.log("\n3. User B re-reads their contact:");

  const after = await dataApi(`/contacts?select=*&id=eq.${secret.id}`, userB.token);
  const [survivor] = await after.json();

  check('the contact still exists', Boolean(survivor));
  check(
    'its name was not modified',
    survivor?.name === secret.name,
    `expected "${secret.name}", got "${survivor?.name}"`
  );
  check('it is still owned by User B', survivor?.user_id === userB.userId);

  // Clean up.
  await dataApi(`/contacts?id=eq.${secret.id}`, userB.token, { method: 'DELETE' });

  console.log('\n' + '='.repeat(58));
  console.log(`${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\nRLS IS NOT PROTECTING THIS TABLE.');
    process.exit(1);
  }
  console.log('\nUser A cannot read, modify, or delete User B\'s contacts.');
}

main().catch((error) => {
  console.error('\nTest run failed:', error.message);
  process.exit(1);
});
