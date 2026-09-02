# Networking Tracker

A private contact tracker for the people you want to stay connected with at Berkeley. Every
contact belongs to exactly one account, and that ownership is enforced by PostgreSQL Row Level
Security rather than by application code — so even a bug in the API, or a request that skips the
API entirely, cannot expose one user's contacts to another.

**Live app:** _pending deployment_

---

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Technology stack](#technology-stack-and-why)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database schema](#database-schema)
- [Authentication and RLS ownership](#authentication-and-rls-ownership)
- [Testing](#testing)
- [Grading evidence](#grading-evidence)
- [Deployment](#deployment)
- [Known limitations](#known-limitations-and-what-id-do-next)

---

## Features

- Email and password sign-up, sign-in, and sign-out via Neon Managed Better Auth
- A private contact list per account — name, company, role, where you met, notes, and priority
- Create, edit, and delete contacts, with a confirmation step before deleting
- Sort by name, company, priority, or date added; filter by priority; search across every field
- Contacts persist in Neon Postgres and survive a refresh
- Distinct loading, empty, filtered-empty, success, and error states
- Responsive: a table on desktop, cards on mobile, with 44px touch targets
- Validation in two independent layers — the API rejects bad input, and the database's own
  constraints reject it again

## Screenshots

_Added after deployment._

## Technology stack and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast builds, and the assignment required React |
| Styling | Tailwind CSS v4 + shadcn/ui patterns | Component source lives in this repo, so every line is ours to explain; responsive layout without a separate stylesheet |
| Backend | Node + Express 5 + TypeScript | A genuinely separate service, as required — its own package, dependencies, and tests |
| Validation | Zod | One schema defines the API contract and the unit tests |
| Auth | Neon Managed Better Auth | Issues the JWT whose `sub` claim drives RLS |
| Data access | Neon Data API (PostgREST) | Lets the backend query *as the signed-in user*, so RLS applies to every request |
| Database | Neon Postgres | RLS is the security model the assignment specifies |
| Hosting | Vercel | Static frontend and serverless API from one repository |

## Architecture

```
Browser — React + @neondatabase/neon-js
   │
   │  1. sign up / sign in / sign out
   ├──────────────────────────────────────────►  Neon Managed Better Auth
   │                                                • opaque session cookie
   │  2. session yields a JWT whose `sub` is the     • JWT for API access
   │     user id
   │
   │  3. fetch /api/contacts
   │     Authorization: Bearer <JWT>
   ▼
Express backend  (Vercel serverless function)
   │
   │  4. verify the JWT's signature against Neon's JWKS  ──►  ${AUTH_URL}/.well-known/jwks.json
   │     invalid or expired  →  401
   │
   │  5. validate the body with Zod
   │     empty name or bad priority  →  400 with per-field messages
   │
   │  6. forward THE SAME USER'S JWT to the Data API
   ▼
Neon Data API (PostgREST)
   │
   ▼
Neon Postgres
     RLS policies compare auth.user_id() — the JWT's `sub` — to each row's user_id.
     The database decides which rows exist for this request.
```

### How the pieces stay separate

`frontend/` and `backend/` are separate npm workspaces with their own `package.json`,
dependencies, and TypeScript configuration. They share no code and communicate only over
HTTP + JSON with a Bearer token.

The frontend contains no SQL, no database driver, and no Data API calls for contact data. The
backend contains no UI. `api/index.ts` is a small adapter that mounts the Express app as a Vercel
function — the backend also runs standalone with `npm run dev:backend`, with no Vercel involved.

### Why the backend forwards the user's token

The obvious way to build a Node backend is to connect with `DATABASE_URL` and write
`WHERE user_id = $1`. This project deliberately does not do that. Under that design the database
would happily return any row, and the only thing standing between one user and another's data
would be a `WHERE` clause — one forgotten filter from a breach, with the RLS policies reduced to
decoration.

Instead the backend holds **no database credentials at all**. It forwards the caller's own JWT to
the Data API, so every query runs with that user's identity and Postgres itself filters the rows.
`DATABASE_URL` is used only by the local migration script and is deliberately *not* configured in
Vercel.

The practical consequence: an attacker who bypasses the backend entirely and calls the public Data
API directly with a valid token still cannot read anyone else's contacts. That is what
`npm run test:rls` demonstrates.

## Local setup

Requires Node 20+.

```bash
git clone <this-repo-url>
cd networkingtracker
npm install
```

Create the database objects (see [Environment variables](#environment-variables) first):

```bash
cp .env.example .env.local   # then fill in real values
npm run db:migrate
```

Run the app — the frontend proxies `/api` to the backend, mirroring production:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

To run them separately: `npm run dev:frontend` and `npm run dev:backend`.

## Environment variables

Copy `.env.example` to `.env.local`. `.env.local` is gitignored and no real value is committed.

The assignment lists the public variables with Next.js's `NEXT_PUBLIC_` prefix. This frontend is
React + Vite, where only `VITE_`-prefixed variables reach the browser, so the names differ while
the values and their public/server-only split are exactly as specified:

| Assignment name | Used here | Exposure |
|---|---|---|
| `NEXT_PUBLIC_NEON_AUTH_URL` | `VITE_NEON_AUTH_URL` | Public — in the browser bundle |
| `NEXT_PUBLIC_NEON_DATA_API_URL` | `VITE_NEON_DATA_API_URL` | Public — see note below |
| — | `NEON_AUTH_URL` | Server-only — JWKS verification |
| — | `NEON_DATA_API_URL` | Server-only — backend → PostgREST |
| `DATABASE_URL` | `DATABASE_URL` | **Secret. Local migrations only; never set in Vercel** |

**On `VITE_NEON_DATA_API_URL`.** Because a Node backend sits between the browser and the database,
the browser never queries the Data API — it needs only the Auth URL. The variable is declared for
parity with the assignment's list, and `scripts/rls-two-user-test.mjs` points a real user's real
token at that exact public URL to prove RLS holds even when the endpoint is known. The assignment
says the frontend *may* use the public Data API URL; the binding requirement is that RLS protects
every exposed row, which this design satisfies more strictly by exposing fewer rows to the client
at all.

## Database schema

`db/schema.sql` is the single source of truth. Every column of the `contacts` table:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `user_id` | `text` | **`not null`, `default auth.user_id()`** | Owner. Filled from the JWT, never from client input |
| `name` | `text` | `not null`, `check (length(btrim(name)) > 0)` | Rejects `''` and whitespace-only |
| `company` | `text` | nullable | |
| `role` | `text` | nullable | |
| `where_met` | `text` | nullable | |
| `notes` | `text` | nullable | |
| `priority` | `text` | `not null`, `default 'medium'`, `check (priority in ('high','medium','low'))` | |
| `created_at` | `timestamptz` | `not null default now()` | |
| `updated_at` | `timestamptz` | `not null default now()` | Set by the API on edit |

Indexed on `(user_id, created_at desc)` to match the default listing.

## Authentication and RLS ownership

**The request flow.** A user signs in against Managed Better Auth, which returns a JWT whose `sub`
claim is their user id. The browser sends that JWT to the Express backend, which verifies its
signature against Neon's JWKS endpoint (EdDSA/Ed25519) before doing anything else. The backend then
forwards the same token to the Data API, so the query reaches Postgres carrying the user's identity.

**The ownership rule.** `auth.user_id()` returns the JWT's `sub` claim as text. Every policy on
`contacts` compares it to the row's `user_id`:

```sql
alter table contacts enable row level security;

create policy contacts_select_own on contacts
  for select to authenticated using (auth.user_id() = user_id);

create policy contacts_insert_own on contacts
  for insert to authenticated with check (auth.user_id() = user_id);

create policy contacts_update_own on contacts
  for update to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

create policy contacts_delete_own on contacts
  for delete to authenticated using (auth.user_id() = user_id);
```

Four separate policies, one per operation, rather than a single `FOR ALL`.

**Why `USING` and `WITH CHECK` are both present on update.** `USING` decides which existing rows an
`UPDATE` is allowed to target — it stops a user editing someone else's row. `WITH CHECK` re-tests
the row *after* modification, which is what stops a user rewriting `user_id` to hand their own row
to another account. Without it, ownership could be transferred; with it, such an update matches
zero rows.

**Ownership cannot be supplied by the client.** `user_id` is absent from every Zod schema, so the
backend strips it from any request body before the database is touched. Ownership comes only from
the verified JWT via the column default. Two automated tests cover exactly this.

## Testing

```bash
npm test
```

Runs 19 Vitest cases against the validation layer. They need no network, database, or credentials,
so they pass on a fresh clone. They cover:

- Empty, whitespace-only, missing, and over-long names are rejected
- `priority` accepts only `high`, `medium`, `low` — `'urgent'` and `'HIGH'` are rejected
- `priority` defaults to `medium`
- A `user_id` or `id` smuggled into a create or update body is stripped, not honoured
- Edits are partial but still validated, and an empty edit is rejected
- Empty optional fields normalise to `null` rather than `''`

### Two-account privacy test

```bash
npm run test:rls
```

Requires `.env.local` with two real test accounts. It signs in as both users, has User B create a
contact, then has User A attempt to read, modify, reassign, and delete it — **both through the
backend and directly against the public Data API** — before confirming with User B that the row is
untouched. The direct-Data-API leg is the meaningful one: it proves RLS is doing the work, not the
backend's filtering.

Both write attempts use `Prefer: return=representation`, because PostgREST answers a write that
matched zero rows with a bare `204` that would otherwise be indistinguishable from success.

## Grading evidence

_Added after deployment._

## Deployment

_Added after deployment._

## Known limitations and what I'd do next

- `@neondatabase/neon-js` is published only as a beta (`0.7.0-beta`); its API may change.
- The frontend bundle is ~636 kB uncompressed (~178 kB gzipped), most of it the auth SDK. Route-level
  code splitting would trim it.
- Sorting and filtering happen in the browser over the full contact list. Correct and instant at
  personal-address-book scale, but a user with thousands of contacts would want server-side paging.
- No automated end-to-end browser test; the CRUD flows were verified by hand and by the RLS script.
- Sessions rely on the auth SDK's own storage, so there is no "remember this device" control.
- Deleting is permanent — no soft delete or undo.
