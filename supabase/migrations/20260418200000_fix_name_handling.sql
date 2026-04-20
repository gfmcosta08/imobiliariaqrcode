-- Fix name handling: remove "Cliente XXXX" fallbacks, add name confirmation states

-- 1. Fix extract_first_name: return '' instead of 'Cliente' for empty input
create or replace function public.extract_first_name(p_full_name text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text := btrim(coalesce(p_full_name, ''));
begin
  if cleaned = '' then
    return '';
  end if;
  return split_part(cleaned, ' ', 1);
end;
$$;

-- 2. Fix upsert_lead_from_qr_event:
--    - New lead: use '' instead of 'Cliente XXXX' as fallback
--    - Existing lead: update nome_completo from profileName when current name is generic
create or replace function public.upsert_lead_from_qr_event(
  p_property_id uuid,
  p_broker_id uuid,
  p_client_phone text,
  p_nome_informado text default null,
  p_nome_perfil text default null,
  p_observacao text default null,
  p_origem text default 'qr_code_anuncio',
  p_interaction_type text default 'qr_interaction',
  p_intent text default 'visit_interest',
  p_force_name_update boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_existing public.leads%rowtype;
  v_lead_id uuid;
  v_nome_informado text := nullif(btrim(coalesce(p_nome_informado, '')), '');
  v_nome_perfil text := nullif(btrim(coalesce(p_nome_perfil, '')), '');
  v_nome_full text;
  v_nome_validado boolean;
  v_obs text;
  v_interesses text[];
begin
  if p_property_id is null or p_broker_id is null then
    raise exception 'property_id e broker_id são obrigatórios';
  end if;

  if v_phone = '' then
    raise exception 'telefone inválido';
  end if;

  select *
  into v_existing
  from public.leads l
  where l.property_id = p_property_id
    and coalesce(nullif(l.telefone, ''), l.client_phone) = v_phone
  order by l.created_at asc
  limit 1;

  if not found then
    -- Use profileName as fallback; empty string when no name available at all
    v_nome_full := coalesce(v_nome_informado, v_nome_perfil, '');
    v_nome_validado := v_nome_informado is not null;
    v_interesses := public.infer_lead_interests(coalesce(p_observacao, '') || ' ' || coalesce(p_intent, ''));

    insert into public.leads (
      property_id,
      broker_id,
      client_phone,
      telefone,
      source,
      intent,
      status,
      nome_completo,
      primeiro_nome,
      observacoes,
      interesses,
      origem,
      nome_validado
    )
    values (
      p_property_id,
      p_broker_id,
      v_phone,
      v_phone,
      'qr_whatsapp',
      coalesce(nullif(p_intent, ''), 'visit_interest'),
      'new',
      v_nome_full,
      public.extract_first_name(v_nome_full),
      coalesce(p_observacao, ''),
      coalesce(v_interesses, '{}'::text[]),
      coalesce(nullif(p_origem, ''), 'qr_code_anuncio'),
      v_nome_validado
    )
    returning id into v_lead_id;
  else
    v_lead_id := v_existing.id;
    v_nome_full := coalesce(nullif(v_existing.nome_completo, ''), '');
    v_nome_validado := coalesce(v_existing.nome_validado, false);

    if p_force_name_update and v_nome_informado is not null then
      -- Explicit name correction always wins
      v_nome_full := v_nome_informado;
      v_nome_validado := true;
    elsif v_nome_informado is not null and not v_nome_validado then
      -- User typed their name and it's not yet validated
      v_nome_full := v_nome_informado;
      v_nome_validado := true;
    elsif v_nome_perfil is not null and not v_nome_validado
      and (v_nome_full = '' or lower(v_nome_full) like 'cliente%') then
      -- WhatsApp name available and stored name is empty or generic fallback
      v_nome_full := v_nome_perfil;
    end if;

    v_obs := coalesce(v_existing.observacoes, '');
    if p_observacao is not null and btrim(p_observacao) <> '' then
      if v_obs <> '' then
        v_obs := v_obs || E'\n';
      end if;
      v_obs := v_obs || to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI') || ' - ' || btrim(p_observacao);
    end if;

    v_interesses := public.infer_lead_interests(
      coalesce(p_observacao, '') || ' ' || coalesce(p_intent, ''),
      coalesce(v_existing.interesses, '{}'::text[])
    );

    update public.leads
    set
      client_phone = v_phone,
      telefone = v_phone,
      nome_completo = v_nome_full,
      primeiro_nome = public.extract_first_name(v_nome_full),
      nome_validado = v_nome_validado,
      observacoes = v_obs,
      interesses = coalesce(v_interesses, '{}'::text[]),
      origem = coalesce(nullif(v_existing.origem, ''), coalesce(nullif(p_origem, ''), 'qr_code_anuncio')),
      intent = coalesce(nullif(p_intent, ''), v_existing.intent),
      updated_at = now()
    where id = v_lead_id;
  end if;

  insert into public.lead_interactions (lead_id, interaction_type, payload)
  values (
    v_lead_id,
    coalesce(nullif(p_interaction_type, ''), 'qr_interaction'),
    jsonb_build_object(
      'phone', v_phone,
      'name_informed', v_nome_informado,
      'name_profile', v_nome_perfil,
      'observation', p_observacao,
      'intent', p_intent,
      'force_name_update', p_force_name_update
    )
  );

  return v_lead_id;
end;
$$;

-- 3. Backfill: zerar nome genérico para leads não validados
--    Na próxima interação o SQL acima atualiza com o profileName do WhatsApp
update public.leads
set
  nome_completo = '',
  primeiro_nome = '',
  updated_at = now()
where
  nome_validado = false
  and (
    lower(nome_completo) like 'cliente%'
    or nome_completo = ''
  );

-- 4. Expandir o check constraint de conversation_sessions.state
--    para incluir os novos estados de confirmação de nome
do $$
declare
  v_constraint_name text;
begin
  select constraint_name
  into v_constraint_name
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'conversation_sessions'
    and constraint_type = 'CHECK'
    and constraint_name ilike '%state%';

  if v_constraint_name is not null then
    execute 'alter table public.conversation_sessions drop constraint ' || quote_ident(v_constraint_name);
  end if;
end;
$$;

alter table public.conversation_sessions
  add constraint conversation_sessions_state_check check (state in (
    'started',
    'property_sent',
    'awaiting_main_choice',
    'recommendations_sent',
    'awaiting_recommendation_choice',
    'visit_interest_registered',
    'closed',
    'error',
    'awaiting_name_confirmation',
    'awaiting_name_input'
  ));
