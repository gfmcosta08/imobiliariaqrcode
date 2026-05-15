-- Clarifica o ciclo de vida dos convites cortesia no ambiente de teste/staging.
-- pending   = convite gerado, ainda nao usado
-- claimed   = corretor concluiu o perfil e esta no onboarding do anuncio
-- completed = anuncio inicial do convite foi finalizado/publicado
-- expired/canceled = convite encerrado sem conclusao

alter table public.broker_invitations
  add column if not exists completed_at timestamptz;

alter table public.broker_invitations
  drop constraint if exists broker_invitations_status_check;

alter table public.broker_invitations
  add constraint broker_invitations_status_check
  check (status in ('pending', 'claimed', 'completed', 'expired', 'canceled'));

create or replace function public.get_my_invitation_property()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select property_id
  from public.broker_invitations
  where temp_auth_user_id = auth.uid()
    and status in ('pending', 'claimed')
  order by generated_at desc
  limit 1;
$$;

grant execute on function public.get_my_invitation_property() to authenticated;
