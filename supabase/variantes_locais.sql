-- 2 variantes persistentes por local. Executar uma vez no Supabase SQL Editor.
-- Preserva os registos antigos; a variante por omissão é A.
alter table public.game_scene_images
  add column if not exists variant text not null default 'a';
alter table public.game_scene_images
  drop constraint if exists game_scene_images_variant_check;
alter table public.game_scene_images
  add constraint game_scene_images_variant_check
  check (variant in ('a','b'));

drop index if exists public.game_scene_images_unique_base;
create unique index if not exists game_scene_images_unique_base_variant
  on public.game_scene_images (campaign_id, location_id, variant)
  where scope='location_base';

-- Corrigir o alias já observado: só se ainda não existir a localização canónica
-- com a mesma variante. Se ambas existirem, preservar ambas para análise.
update public.game_scene_images i
set location_id='blackwood-ruinas'
where i.campaign_id='veu'
  and i.location_id='ruinas-torre-blackwood'
  and not exists(
    select 1 from public.game_scene_images j
    where j.campaign_id=i.campaign_id and j.scope='location_base'
     and j.location_id='blackwood-ruinas' and j.variant=i.variant
  );

-- As imagens passam a usar ficheiros a.jpg e b.jpg. Os ficheiros antigos
-- mantêm os seus nomes e são referidos pela coluna storage_path.
select campaign_id,location_id,variant,storage_path
from public.game_scene_images
order by campaign_id,location_id,variant;
