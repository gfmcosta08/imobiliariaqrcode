begin;
create table if not exists public.checkout_legal_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  account_id uuid not null references public.accounts (id),
  terms_version text not null,
  privacy_version text not null,
  refund_cancellation_version text not null,
  accepted_at timestamptz not null default now()
);
comment on table public.checkout_legal_acceptance_events is
  'Append-only legal evidence captured before creating Stripe Checkout Sessions.';
create index if not exists idx_checkout_legal_acceptance_events_profile
  on public.checkout_legal_acceptance_events (profile_id, accepted_at desc);
alter table public.checkout_legal_acceptance_events enable row level security;
revoke all on public.checkout_legal_acceptance_events from public, anon, authenticated;
create or replace function private.reject_checkout_legal_acceptance_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'checkout_legal_acceptance_events is append-only';
end;
$$;
drop trigger if exists trg_checkout_legal_acceptance_events_reject_mutation
on public.checkout_legal_acceptance_events;
create trigger trg_checkout_legal_acceptance_events_reject_mutation
before update or delete on public.checkout_legal_acceptance_events
for each row
execute function private.reject_checkout_legal_acceptance_event_mutation();
commit;
