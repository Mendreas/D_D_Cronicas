-- Crónicas do Véu: controlo de gerações simultâneas no Supabase
-- Executar depois de game_scene_images e bucket scene-images existirem.
-- A função Netlify é a única autorizada a criar/resolver estas reservas.

create table if not exists public.game_scene_generation_locks (
  cache_key text primary key,
  status text not null default 'generating'
    check (status in ('generating','failed')),
  updated_at timestamptz not null default now()
);
alter table public.game_scene_generation_locks enable row level security;
revoke all on public.game_scene_generation_locks from public, anon, authenticated;

create or replace function public.claim_scene_generation(p_cache_key text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_ok boolean;
begin
  if p_cache_key is null or char_length(p_cache_key) not between 10 and 400
  then raise exception 'Chave de cache inválida'; end if;

  insert into public.game_scene_generation_locks(cache_key,status)
    values(p_cache_key,'generating')
  on conflict(cache_key) do update
    set status='generating', updated_at=now()
    where public.game_scene_generation_locks.status='failed'
       or public.game_scene_generation_locks.updated_at < now()-interval '100 seconds'
  returning true into v_ok;
  return coalesce(v_ok,false);
end; $$;
create or replace function public.release_scene_generation(p_cache_key text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 delete from public.game_scene_generation_locks
 where cache_key=p_cache_key;
end; $$;
revoke all on function public.claim_scene_generation(text),
  public.release_scene_generation(text) from public,anon,authenticated;
grant execute on function public.claim_scene_generation(text),
  public.release_scene_generation(text) to service_role;

-- Restringir escrita das imagens ao backend; as imagens públicas mantêm leitura pública.
revoke insert,update,delete on public.game_scene_images from authenticated;
drop policy if exists game_scene_images_insert_auth on public.game_scene_images;
drop policy if exists game_scene_images_update_auth on public.game_scene_images;

-- O bucket scene-images é público por escolha do projeto. Sem upload direto do browser.
select id,public from storage.buckets where id='scene-images';
