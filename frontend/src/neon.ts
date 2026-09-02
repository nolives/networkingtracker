import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

/**
 * The two-URL object form, as the assignment specifies.
 *
 * Only the Auth URL is actually exercised by this app: the browser signs in
 * here and reads its session, then talks to our own Node backend for contact
 * data. The Data API URL is supplied for parity with the assignment's variable
 * list -- and it is the URL that scripts/rls-two-user-test.mjs attacks directly
 * to demonstrate that RLS, not our backend, is what stops cross-user access.
 */
const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

// Fail loudly. If these are undefined the auth SDK quietly falls back to a
// relative /api/auth path and every request 404s against our own origin --
// which looks like a broken backend rather than missing configuration.
if (!authUrl) {
  throw new Error(
    'VITE_NEON_AUTH_URL is not set. Copy .env.example to .env.local at the repository root.'
  );
}

export const neon = createClient({
  auth: {
    url: authUrl,
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: dataApiUrl,
  },
});
