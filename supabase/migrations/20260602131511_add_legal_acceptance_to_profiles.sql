alter table public.profiles
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists accepted_terms_version text,
  add column if not exists accepted_privacy_at timestamptz,
  add column if not exists accepted_privacy_version text,
  add column if not exists accepted_legal_source text;

alter table public.profiles
  add constraint profiles_accepted_legal_source_check
  check (
    accepted_legal_source is null
    or accepted_legal_source in ('signup', 'invitation_onboarding')
  );

comment on column public.profiles.accepted_terms_at is 'Data e hora do aceite dos Termos de Uso.';
comment on column public.profiles.accepted_terms_version is 'Versao dos Termos de Uso aceita pelo usuario.';
comment on column public.profiles.accepted_privacy_at is 'Data e hora do aceite da Politica de Privacidade.';
comment on column public.profiles.accepted_privacy_version is 'Versao da Politica de Privacidade aceita pelo usuario.';
comment on column public.profiles.accepted_legal_source is 'Fluxo em que o aceite legal foi registrado.';
