begin;

create temp table qa_legal_ids (
  profile_id uuid not null,
  before_events bigint not null
) on commit drop;

insert into qa_legal_ids (profile_id, before_events)
select
  p.id,
  (
    select count(*)
    from public.legal_acceptance_events e
    where e.subject_profile_id = p.id
  )
from public.profiles p
order by p.created_at
limit 1;

do $$
begin
  if not exists (select 1 from qa_legal_ids) then
    raise exception 'QA requires at least one existing staging profile';
  end if;
end;
$$;

update public.profiles p
set
  accepted_terms_at = now(),
  accepted_terms_version = '2026-06-02-qa-rollback',
  accepted_privacy_at = now(),
  accepted_privacy_version = '2026-06-02-qa-rollback',
  accepted_legal_source = 'signup'
from qa_legal_ids q
where p.id = q.profile_id;

do $$
declare
  event_id uuid;
  mutation_rejected boolean := false;
begin
  if (
    select count(*) - q.before_events
    from public.legal_acceptance_events e
    join qa_legal_ids q on q.profile_id = e.subject_profile_id
    group by q.before_events
  ) <> 1 then
    raise exception 'expected exactly one acceptance event';
  end if;

  select e.id
  into event_id
  from public.legal_acceptance_events e
  join qa_legal_ids q on q.profile_id = e.subject_profile_id
  order by e.created_at desc
  limit 1;

  begin
    update public.legal_acceptance_events
    set legal_source = 'signup'
    where id = event_id;
  exception
    when others then
      if position('append-only' in sqlerrm) = 0 then
        raise;
      end if;
      mutation_rejected := true;
  end;

  if not mutation_rejected then
    raise exception 'append-only guard did not reject mutation';
  end if;
end;
$$;

rollback;

select 'passed_with_rollback' as qa_result;
