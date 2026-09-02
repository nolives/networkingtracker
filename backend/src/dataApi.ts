/**
 * A thin PostgREST client for the Neon Data API.
 *
 * The important property: every request carries the CALLER'S OWN JWT, not a
 * service key and not a Postgres connection string. The backend therefore has
 * exactly the database privileges of the user making the request, and RLS
 * decides which rows come back. A filtering bug here cannot leak another
 * user's data, because Postgres never sends it in the first place.
 *
 * The backend holds no DATABASE_URL at runtime.
 */

const dataApiUrl = process.env.NEON_DATA_API_URL;

if (!dataApiUrl) {
  throw new Error('NEON_DATA_API_URL is not set.');
}

const base = dataApiUrl.replace(/\/+$/, '');

export class DataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'DataApiError';
  }
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  accessToken: string;
  body?: unknown;
  /**
   * Ask PostgREST to return affected rows. Essential for writes: a DELETE or
   * PATCH that RLS filtered down to zero rows returns 204 with no body, which
   * is otherwise indistinguishable from a successful write.
   */
  representation?: boolean;
}

async function request<T>({
  method,
  path,
  accessToken,
  body,
  representation = true,
}: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (representation) headers['Prefer'] = 'return=representation';

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const parsed = text ? safeJson(text) : null;

  if (!response.ok) {
    const detail = (parsed ?? {}) as {
      message?: string;
      code?: string;
      details?: string;
    };
    throw new DataApiError(
      detail.message ?? `Data API request failed (${response.status}).`,
      response.status,
      detail.code
    );
  }

  return (parsed ?? []) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface ContactRow {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  where_met: string | null;
  notes: string | null;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
}

/** All contacts visible to this token. RLS scopes it to the caller's own. */
export function listContacts(accessToken: string): Promise<ContactRow[]> {
  return request<ContactRow[]>({
    method: 'GET',
    path: '/contacts?select=*&order=created_at.desc',
    accessToken,
    representation: false,
  });
}

export function getContact(
  accessToken: string,
  id: string
): Promise<ContactRow[]> {
  return request<ContactRow[]>({
    method: 'GET',
    path: `/contacts?select=*&id=eq.${encodeURIComponent(id)}`,
    accessToken,
    representation: false,
  });
}

/**
 * user_id is intentionally omitted from the payload: the column's
 * `default auth.user_id()` fills it from the JWT, and the INSERT policy's
 * WITH CHECK would reject anything else.
 */
export function insertContact(
  accessToken: string,
  values: Record<string, unknown>
): Promise<ContactRow[]> {
  return request<ContactRow[]>({
    method: 'POST',
    path: '/contacts?select=*',
    accessToken,
    body: values,
  });
}

export function updateContact(
  accessToken: string,
  id: string,
  values: Record<string, unknown>
): Promise<ContactRow[]> {
  return request<ContactRow[]>({
    method: 'PATCH',
    path: `/contacts?select=*&id=eq.${encodeURIComponent(id)}`,
    accessToken,
    body: values,
  });
}

export function deleteContact(
  accessToken: string,
  id: string
): Promise<ContactRow[]> {
  return request<ContactRow[]>({
    method: 'DELETE',
    path: `/contacts?select=*&id=eq.${encodeURIComponent(id)}`,
    accessToken,
  });
}
