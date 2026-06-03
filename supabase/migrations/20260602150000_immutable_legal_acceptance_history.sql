begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists public.legal_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  legal_source text not null
    check (legal_source in ('signup', 'invitation_onboarding')),
  accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.legal_acceptance_events is
  'Append-only evidence of accepted legal document versions. Access is restricted to trusted backend roles.';
comment on column public.legal_acceptance_events.subject_profile_id is
  'Pseudonymous profile identifier retained for legal evidence; define retention with legal counsel.';

create index if not exists idx_legal_acceptance_events_subject_profile_id
  on public.legal_acceptance_events (subject_profile_id, accepted_at desc);

alter table public.legal_acceptance_events enable row level security;

create or replace function private.log_legal_acceptance_event()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.accepted_terms_at is null
    or new.accepted_privacy_at is null
    or new.accepted_terms_version is null
    or new.accepted_privacy_version is null
    or new.accepted_legal_source is null
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.accepted_terms_at is not distinct from old.accepted_terms_at
    and new.accepted_privacy_at is not distinct from old.accepted_privacy_at
    and new.accepted_terms_version is not distinct from old.accepted_terms_version
    and new.accepted_privacy_version is not distinct from old.accepted_privacy_version
    and new.accepted_legal_source is not distinct from old.accepted_legal_source
  then
    return new;
  end if;

  insert into public.legal_acceptance_events (
    subject_profile_id,
    terms_version,
    privacy_version,
    legal_source,
    accepted_at
  )
  values (
    new.id,
    new.accepted_terms_version,
    new.accepted_privacy_version,
    new.accepted_legal_source,
    greatest(new.accepted_terms_at, new.accepted_privacy_at)
  );

  return new;
end;
$$;

create or replace function private.reject_legal_acceptance_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'legal_acceptance_events is append-only';
end;
$$;

drop trigger if exists trg_profiles_log_legal_acceptance on public.profiles;
create trigger trg_profiles_log_legal_acceptance
after insert or update of
  accepted_terms_at,
  accepted_terms_version,
  accepted_privacy_at,
  accepted_privacy_version,
  accepted_legal_source
on public.profiles
for each row
execute function private.log_legal_acceptance_event();

drop trigger if exists trg_legal_acceptance_events_reject_mutation
on public.legal_acceptance_events;
create trigger trg_legal_acceptance_events_reject_mutation
before update or delete on public.legal_acceptance_events
for each row
execute function private.reject_legal_acceptance_event_mutation();

commit;
