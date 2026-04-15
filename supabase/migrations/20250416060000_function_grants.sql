grant execute on function public.recommend_similar_properties(uuid, integer) to service_role;
grant execute on function public.register_print_event(uuid, uuid, uuid, text) to service_role;
grant execute on function public.expire_free_properties() to service_role;
grant execute on function public.create_lead_from_visit_interest(uuid, uuid, text, text) to service_role;
