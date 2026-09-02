import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies the caller's Neon Managed Better Auth JWT.
 *
 * This is defence in depth rather than the primary access control: the
 * database is the real gate, because every Data API request carries this same
 * token and RLS compares auth.user_id() to each row's user_id. Verifying here
 * simply means an unauthenticated caller gets a clean 401 instead of an opaque
 * error bubbling back from PostgREST.
 *
 * Neon signs with EdDSA (Ed25519) and publishes keys at
 * ${NEON_AUTH_URL}/.well-known/jwks.json.
 */

const authUrl = process.env.NEON_AUTH_URL;

if (!authUrl) {
  throw new Error(
    'NEON_AUTH_URL is not set. The backend cannot verify tokens without it.'
  );
}

const normalised = authUrl.replace(/\/+$/, '');

/**
 * Neon's docs and their Hono guide disagree on whether `iss` is the auth URL's
 * origin or its full path, so both are accepted. The issuer stays pinned to a
 * known set -- this is not `issuer: undefined`.
 */
const acceptedIssuers = [new URL(normalised).origin, normalised];

// Module scope: the key set is fetched once and cached across warm invocations.
const jwks = createRemoteJWKSet(new URL(`${normalised}/.well-known/jwks.json`));

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The verified JWT subject: the signed-in user's id. */
      userId?: string;
      /** The raw token, forwarded verbatim to the Data API. */
      accessToken?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Not signed in.',
      detail: 'Missing Authorization: Bearer <token> header.',
    });
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: acceptedIssuers,
    });

    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid token: no subject claim.' });
      return;
    }

    req.userId = payload.sub;
    req.accessToken = token;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    // Expired tokens are routine (the client refreshes and retries), so they
    // are distinguished from genuinely malformed ones.
    const expired = message.includes('exp');
    res.status(401).json({
      error: expired ? 'Session expired. Please sign in again.' : 'Invalid token.',
    });
  }
}
