drop index if exists public.idx_resumes_user_uploaded_at;
drop index if exists public.idx_applications_user_applied_at;
drop index if exists public.idx_applications_user_status;
drop index if exists public.idx_timeline_events_user_application_created_at;

alter table public.timeline_events
  drop column if exists user_id cascade;

alter table public.applications
  drop column if exists user_id cascade;

alter table public.resumes
  drop column if exists user_id cascade;

alter table public.resumes
  drop constraint if exists resumes_user_id_filename_key;

alter table public.resumes
  drop constraint if exists resumes_filename_key;

alter table public.resumes
  add constraint resumes_filename_key unique (filename);

create index if not exists idx_resumes_uploaded_at
  on public.resumes (uploaded_at desc);

create index if not exists idx_applications_applied_at
  on public.applications (applied_at desc);

create index if not exists idx_applications_status
  on public.applications (status);

create index if not exists idx_timeline_events_application_created_at
  on public.timeline_events (application_id, created_at desc);
