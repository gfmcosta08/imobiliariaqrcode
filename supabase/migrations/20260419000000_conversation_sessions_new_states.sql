-- Adiciona target_property_id para o fluxo de visita a imóvel recomendado
alter table public.conversation_sessions
  add column if not exists target_property_id uuid references public.properties (id) on delete set null;

-- Atualiza constraint de state para incluir novos estados
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
    'awaiting_name_input',
    'awaiting_post_similar_choice',
    'awaiting_visit_property_id'
  ));
