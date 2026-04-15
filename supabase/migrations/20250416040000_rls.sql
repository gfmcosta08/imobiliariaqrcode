-- RLS: isolamento por account (profiles.account_id).

create or replace function public.current_account_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select account_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_account_id() to authenticated;

alter table public.plans enable row level security;
alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.brokers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.properties enable row level security;
alter table public.property_features enable row level security;
alter table public.property_media enable row level security;
alter table public.property_qrcodes enable row level security;
alter table public.partners enable row level security;
alter table public.partner_users enable row level security;
alter table public.print_events enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.conversation_sessions enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.webhook_events enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "plans_select_authenticated"
on public.plans
for select
to authenticated
using (true);

create policy "accounts_select_own"
on public.accounts
for select
to authenticated
using (id = public.current_account_id());

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "brokers_select_own"
on public.brokers
for select
to authenticated
using (account_id = public.current_account_id());

create policy "brokers_update_own"
on public.brokers
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using (account_id = public.current_account_id());

create policy "properties_select_own"
on public.properties
for select
to authenticated
using (account_id = public.current_account_id());

create policy "properties_insert_own"
on public.properties
for insert
to authenticated
with check (account_id = public.current_account_id());

create policy "properties_update_own"
on public.properties
for update
to authenticated
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "properties_delete_own"
on public.properties
for delete
to authenticated
using (account_id = public.current_account_id());

create policy "property_features_all_own_property"
on public.property_features
for all
to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_features.property_id
      and p.account_id = public.current_account_id()
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_features.property_id
      and p.account_id = public.current_account_id()
  )
);

create policy "property_media_all_own_property"
on public.property_media
for all
to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_media.property_id
      and p.account_id = public.current_account_id()
  )
)
with check (
  exists (
    select 1 from public.properties p
    where p.id = property_media.property_id
      and p.account_id = public.current_account_id()
  )
);

create policy "property_qrcodes_select_own"
on public.property_qrcodes
for select
to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = property_qrcodes.property_id
      and p.account_id = public.current_account_id()
  )
);

create policy "leads_select_own_broker"
on public.leads
for select
to authenticated
using (
  broker_id in (
    select b.id from public.brokers b
    where b.account_id = public.current_account_id()
  )
);

create policy "lead_interactions_select_own_lead"
on public.lead_interactions
for select
to authenticated
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_interactions.lead_id
      and l.broker_id in (
        select b.id from public.brokers b where b.account_id = public.current_account_id()
      )
  )
);

create policy "print_events_select_own_property"
on public.print_events
for select
to authenticated
using (
  exists (
    select 1 from public.properties p
    where p.id = print_events.property_id
      and p.account_id = public.current_account_id()
  )
);

create policy "partner_users_select_self"
on public.partner_users
for select
to authenticated
using (profile_id = auth.uid());

create policy "partners_select_via_membership"
on public.partners
for select
to authenticated
using (
  exists (
    select 1 from public.partner_users pu
    where pu.partner_id = partners.id and pu.profile_id = auth.uid()
  )
);
