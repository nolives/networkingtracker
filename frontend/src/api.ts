import { neon } from './neon';
import { ApiError, type Contact, type ContactDraft } from './types';

/**
 * The only channel between the browser and contact data. There is no database
 * client here: every call goes to our Node backend, which validates the
 * request and then forwards this same token to the Neon Data API, where RLS
 * decides which rows exist for this user.
 */

/** A JWT is three dot-separated base64url segments. */
function looksLikeJwt(value: unknown): value is string {
  return typeof value === 'string' && value.split('.').length === 3;
}

/**
 * Returns the JWT the Data API accepts.
 *
 * Getting this right took some digging, because the session token and the API
 * token are not the same thing. Managed Better Auth issues an opaque 32-char
 * session token (it starts `rGc8…`, not `eyJ…`), while the Data API wants a
 * signed JWT from `GET {AUTH_URL}/token`. Neon's own backend guide reads
 * `session.token` and forwards it, which would send the opaque one.
 *
 * So: ask the SDK first, but verify what comes back is really a JWT, and fall
 * back to the token endpoint if it is not.
 *
 * Fetched fresh on every request and never cached in React state, so the SDK
 * can rotate an expiring token. Caching it at mount yields an app that works
 * for a few minutes and then fails with 401s.
 */
async function getAccessToken(): Promise<string> {
  const auth = neon.auth as unknown as {
    getJWTToken?: () => Promise<string | null>;
  };

  if (typeof auth.getJWTToken === 'function') {
    const token = await auth.getJWTToken().catch(() => null);
    if (looksLikeJwt(token)) return token;
  }

  // Fall back to the token endpoint. credentials: 'include' sends the auth
  // service's session cookie, which is set on Neon's domain, not ours.
  const response = await fetch(
    `${import.meta.env.VITE_NEON_AUTH_URL.replace(/\/+$/, '')}/token`,
    { credentials: 'include' }
  );

  if (!response.ok) throw new ApiError('You are signed out.', 401);

  const body = await response.json().catch(() => null);
  const token = findJwt(body);

  if (!token) {
    throw new ApiError('Could not read an access token from the session.', 401);
  }

  return token;
}

/** Walks a small object graph looking for a JWT-shaped string. */
function findJwt(value: unknown, depth = 0): string | null {
  if (looksLikeJwt(value)) return value;
  if (depth > 3 || value === null || typeof value !== 'object') return null;
  for (const nested of Object.values(value)) {
    const found = findJwt(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? 'Something went wrong.',
      response.status,
      payload?.fieldErrors ?? []
    );
  }

  return payload as T;
}

/** Trims the form draft; the backend re-validates everything regardless. */
function toPayload(draft: ContactDraft) {
  return {
    name: draft.name.trim(),
    company: draft.company.trim(),
    role: draft.role.trim(),
    where_met: draft.where_met.trim(),
    notes: draft.notes.trim(),
    priority: draft.priority,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const { contacts } = await request<{ contacts: Contact[] }>('/contacts');
  return contacts;
}

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const { contact } = await request<{ contact: Contact }>('/contacts', {
    method: 'POST',
    body: JSON.stringify(toPayload(draft)),
  });
  return contact;
}

export async function updateContact(
  id: string,
  draft: ContactDraft
): Promise<Contact> {
  const { contact } = await request<{ contact: Contact }>(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toPayload(draft)),
  });
  return contact;
}

export async function deleteContact(id: string): Promise<void> {
  await request(`/contacts/${id}`, { method: 'DELETE' });
}
