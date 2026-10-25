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
