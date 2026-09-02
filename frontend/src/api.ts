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
 * Neon's documentation is inconsistent about where the Data API JWT lives:
 * the auth reference says `session.access_token`, while their backend guide
 * reads `session.token`. Rather than betting on one, this probes the session
 * for a value that is actually shaped like a JWT.
 *
 * The token is fetched fresh on every request and never cached in React state,
 * so the SDK can rotate an expiring token. Caching it at mount produces an app
 * that works for a few minutes and then fails with 401s.
 */
async function getAccessToken(): Promise<string> {
  const { data } = await neon.auth.getSession();

  if (!data) throw new ApiError('You are signed out.', 401);

  const session = (data as { session?: Record<string, unknown> }).session ?? {};
  const candidates = [
    session.access_token,
    session.accessToken,
    session.token,
    (data as Record<string, unknown>).access_token,
  ];

  const token = candidates.find(looksLikeJwt);

  if (!token) {
    throw new ApiError(
      'Could not read an access token from the session.',
      401
    );
  }

  return token;
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
