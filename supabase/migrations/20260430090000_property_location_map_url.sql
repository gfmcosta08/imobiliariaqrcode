-- Link de geolocalizacao informado pelo corretor no cadastro do imovel.
-- Nullable para preservar imoveis existentes; a obrigatoriedade fica nas acoes de publicar/finalizar.

alter table public.properties
  add column if not exists location_map_url text;
