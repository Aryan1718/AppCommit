create extension if not exists pgcrypto;

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  size integer,
  uploaded_at timestamptz not null default now(),
  unique (user_id, filename)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  job_title text not null,
  job_description text,
  portal text,
  resume_id uuid references public.resumes(id) on delete set null,
  resume_filename text,
  url text,
  status text not null default 'applied',
  notes text,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_status_check
    check (status in ('applied', 'interview', 'offer', 'rejected', 'withdrawn', 'saved'))
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint timeline_events_type_check
    check (event_type in ('status_change', 'note_added', 'auto_saved', 'application_created', 'application_deleted'))
);

create index if not exists idx_resumes_user_uploaded_at
  on public.resumes (user_id, uploaded_at desc);

create index if not exists idx_applications_user_applied_at
  on public.applications (user_id, applied_at desc);

create index if not exists idx_applications_user_status
  on public.applications (user_id, status);

create index if not exists idx_timeline_events_user_application_created_at
  on public.timeline_events (user_id, application_id, created_at desc);
