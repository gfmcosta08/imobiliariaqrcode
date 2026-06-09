-- Permite cancelamento logico de convites pendentes no painel admin.
-- Sem apagar dados de usuario/imoveis/conta relacionados.

alter table public.broker_invitations
  drop constraint if exists broker_invitations_status_check;
alter table public.broker_invitations
  add constraint broker_invitations_status_check
  check (status in ('pending', 'claimed', 'expired', 'canceled'));
