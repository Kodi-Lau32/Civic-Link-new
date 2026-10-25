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
