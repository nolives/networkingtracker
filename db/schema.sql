-- ============================================================================
-- Secure Networking Tracker — contacts schema, constraints, and RLS policies
-- ============================================================================
-- Prerequisite: the Neon Data API must be enabled on this branch first, which
-- is what creates the `authenticated` role and the auth.user_id() function.
--
-- auth.user_id() returns the `sub` claim of the caller's JWT, as text. Every
-- policy below compares it to the row's user_id column, so Postgres itself --
-- not application code -- decides which rows a request can see or change.
--
-- This script is idempotent: re-running it is safe.
-- ============================================================================

-- gen_random_uuid() is in Postgres core since v13 (Neon runs 16/17), so no
-- pgcrypto extension is required.

create table if not exists contacts (
  id          uuid        primary key default gen_random_uuid(),

  -- Ownership. Defaults to the caller's JWT subject so a client never needs to
  -- supply it -- and NOT NULL means a row can never exist unowned.
  user_id     text        not null default auth.user_id(),

  -- Required field. The CHECK rejects '' and whitespace-only names at the
  -- database level, independently of the backend's Zod validation.
  name        text        not null check (length(btrim(name)) > 0),

  company     text,
  role        text,
  where_met   text,
  notes       text,

  -- Priority is constrained to exactly three values by the database.
  priority    text        not null default 'medium'
                          check (priority in ('high', 'medium', 'low')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Supports the default listing (a user's own contacts, newest first).
create index if not exists contacts_user_id_created_at_idx
  on contacts (user_id, created_at desc);

alter table contacts enable row level security;

-- ---------------------------------------------------------------------------
-- Four SEPARATE policies, one per operation, as the assignment requires
-- (deliberately not a single `FOR ALL` policy).
-- ---------------------------------------------------------------------------

drop policy if exists contacts_select_own on contacts;
create policy contacts_select_own on contacts
  for select to authenticated
  using (auth.user_id() = user_id);

drop policy if exists contacts_insert_own on contacts;
create policy contacts_insert_own on contacts
  for insert to authenticated
  with check (auth.user_id() = user_id);

-- USING decides which existing rows may be targeted by an UPDATE.
-- WITH CHECK re-validates the row AFTER modification, which is what stops a
-- user from rewriting user_id to hand their row to someone else.
drop policy if exists contacts_update_own on contacts;
create policy contacts_update_own on contacts
  for update to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

drop policy if exists contacts_delete_own on contacts;
create policy contacts_delete_own on contacts
  for delete to authenticated
  using (auth.user_id() = user_id);

-- ---------------------------------------------------------------------------
-- Grants. RLS filters rows; grants decide who may attempt an operation at all.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on contacts to authenticated;

-- Signed-out callers get nothing. Guarded, because a bare REVOKE against a
-- role that does not exist on this branch would abort the whole migration.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anonymous') then
    revoke all on contacts from anonymous;
  end if;
end $$;
