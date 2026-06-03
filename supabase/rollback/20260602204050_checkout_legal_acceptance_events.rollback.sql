begin;

drop trigger if exists trg_checkout_legal_acceptance_events_reject_mutation
on public.checkout_legal_acceptance_events;
drop function if exists private.reject_checkout_legal_acceptance_event_mutation();
drop table if exists public.checkout_legal_acceptance_events;

commit;
