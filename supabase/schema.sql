-- Civic Link database (Supabase dashboard > SQL Editor > New query > paste all of this > Run).
-- Safe to run again: it only creates what's missing.
--
-- Who can do what:
--   anyone (the website, using the publishable/anon key)  -> read projects
--   our Node server (using the secret/service_role key)   -> add and edit projects
-- The server checks the login before writing, so the browser can never write directly.

create table if not exists public.projects (
  id           text primary key default gen_random_uuid()::text,
  name         text not null default '',
  description  text not null default '',
  address      text not null default '',
  -- must match PROJECT_TYPES in frontend/js/projects.js
  type         text not null default 'construction'
               check (type in ('construction', 'flock_camera', 'data_center', 'unwanted_repair')),
  -- must match PROJECT_STATUSES in frontend/js/projects.js; null = automatic (worked out from the dates)
  status       text
               check (status in ('proposed', 'ongoing', 'finished', 'rejected')),
  author       text,          -- username of the engineer who submitted it (null on old sheet rows)
  lng          double precision,
  lat          double precision,
  start_date   date,
  end_date     date,
  submitted_at timestamptz default now()  -- null on old sheet rows that had no date
);

create index if not exists projects_author_idx on public.projects (author);

-- Row Level Security: with it on, the publishable key can only do what a policy allows.
-- There are no insert/update/delete policies, so only the server's secret key can write.
alter table public.projects enable row level security;

drop policy if exists "Projects are public" on public.projects;
create policy "Projects are public"
  on public.projects for select
  to anon, authenticated
  using (true);

grant select on table public.projects to anon, authenticated;
grant all on table public.projects to service_role;


-- =====================================================================================================
-- Change 2 (2026-10-22): type becomes a list of tags, short/long descriptions, resources
--
-- HOW TO RUN: if you already ran everything above, paste just this section into the SQL Editor and Run.
-- (Running the whole file also works; every step below is skipped if it's already been done.)
-- Existing projects keep their data: description moves to description_short, and each type becomes
-- a one-tag list, e.g. 'construction' -> {construction}.
--
-- After running, the columns are:
--   type              text[]  tags, e.g. {construction, data_center}; at least one; first tag sets the map color
--   description_short text    one or two sentences, shown on cards, the map sidebar, and the updates gallery
--   description_long  text    full write-up, shown on the project's own page (project.html)
--   resources         text[]  sources the project refers to: links or citations, one per entry
-- =====================================================================================================

-- description -> description_short
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects' and column_name = 'description') then
    alter table public.projects rename column description to description_short;
  end if;
end $$;

alter table public.projects add column if not exists description_long text not null default '';
alter table public.projects add column if not exists resources text[] not null default '{}';

-- type: one value -> list of tags
alter table public.projects drop constraint if exists projects_type_check;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects' and column_name = 'type'
               and data_type = 'text') then
    alter table public.projects alter column "type" drop default;
    alter table public.projects alter column "type" set data type text[] using array["type"];
    alter table public.projects alter column "type" set default '{construction}';
  end if;
end $$;

-- every tag must be in PROJECT_TYPES (frontend/js/projects.js), and there must be at least one.
-- To add a type later, run these two lines again with the new key added to the list.
alter table public.projects drop constraint if exists projects_type_check;
alter table public.projects add constraint projects_type_check
  check (cardinality("type") > 0
         and "type" <@ array['construction', 'flock_camera', 'data_center', 'unwanted_repair']);


-- =====================================================================================================
-- Change 3 (2026-10-26): logins move from the Node server to Supabase Auth
--
-- HOW TO RUN: paste just this section into the SQL Editor and Run (safe to run again).
--
-- The website now writes to the database directly with the logged-in engineer's session, so the
-- database itself enforces the rules the server used to:
--   - only logged-in engineers can add projects, and author is always set to their own username
--   - engineers can only edit their own projects, and only the editable columns
--   - nobody can delete from the website
-- An engineer's username lives in their account's app_metadata, which only an admin can set
-- (see "Adding an engineer account" below), so nobody can claim someone else's username.
-- =====================================================================================================

-- new projects get the logged-in engineer's username as author
alter table public.projects
  alter column author set default (auth.jwt() -> 'app_metadata' ->> 'username');

-- logged-in engineers may only write these columns (not id, author, or submitted_at)
revoke insert, update, delete on table public.projects from anon, authenticated;
grant insert (name, description_short, description_long, resources, address, type, status,
              lng, lat, start_date, end_date) on table public.projects to authenticated;
grant update (name, description_short, description_long, resources, address, type, status,
              lng, lat, start_date, end_date) on table public.projects to authenticated;

drop policy if exists "Engineers add their own projects" on public.projects;
create policy "Engineers add their own projects"
  on public.projects for insert
  to authenticated
  with check (author = (select auth.jwt() -> 'app_metadata' ->> 'username'));

drop policy if exists "Engineers edit their own projects" on public.projects;
create policy "Engineers edit their own projects"
  on public.projects for update
  to authenticated
  using (author = (select auth.jwt() -> 'app_metadata' ->> 'username'))
  with check (author = (select auth.jwt() -> 'app_metadata' ->> 'username'));

-- -----------------------------------------------------------------------------------------------------
-- Adding an engineer account (do this for each engineer; don't run it as part of this section):
--   1. Supabase dashboard > Authentication > Users > Add user > Create new user.
--      Enter their email and a password, and tick "Auto Confirm User".
--   2. Give the account its username (this is what the author column stores) by running,
--      with your values filled in:
--
--        update auth.users
--        set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('username', 'kodilau')
--        where email = 'their-email@example.com';
--
--   3. If they were already logged in, they need to log out and back in to pick up the username.
-- -----------------------------------------------------------------------------------------------------
