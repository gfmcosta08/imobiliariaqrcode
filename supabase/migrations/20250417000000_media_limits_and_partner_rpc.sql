-- Limite de imagens por plano (FREE 10 / PRO 15) e RPC de busca para parceiros.

create or replace function public.before_property_media_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_img integer;
  cnt integer;
  origin text;
begin
  select p.origin_plan_code into origin from public.properties p where p.id = new.property_id;
  if origin is null then
    raise exception 'Imóvel inválido';
  end if;

  select pl.max_images_per_property into max_img from public.plans pl where pl.code = origin;

  select count(*)::integer into cnt
  from public.property_media pm
  where pm.property_id = new.property_id
    and pm.status <> 'deleted';

  if cnt >= max_img then
    raise exception 'Limite de imagens do plano atingido (%).', max_img;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_property_media_before_insert on public.property_media;
create trigger trg_property_media_before_insert
before insert on public.property_media
for each row execute function public.before_property_media_insert();

create or replace function public.partner_lookup_property(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prop record;
begin
  if uid is null then
    raise exception 'Sessão obrigatória';
  end if;

  if not exists (select 1 from public.partner_users pu where pu.profile_id = uid) then
    raise exception 'Acesso restrito a parceiros';
  end if;

  select * into prop from public.properties where public_id = p_public_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'property_id', prop.id,
    'public_id', prop.public_id,
    'title', prop.title,
    'city', prop.city,
    'state', prop.state,
    'listing_status', prop.listing_status
  );
end;
$$;

grant execute on function public.partner_lookup_property(text) to authenticated;
