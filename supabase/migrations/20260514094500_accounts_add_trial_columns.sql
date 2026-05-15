-- Alinha schema de accounts ao contrato atual da aplicacao (trial/cortesia).
-- Idempotente: pode rodar em ambientes ja corrigidos sem efeito colateral.

alter table public.accounts
  add column if not exists trial_started_at timestamptz;

alter table public.accounts
  add column if not exists trial_used_at timestamptz;
