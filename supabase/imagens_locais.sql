-- Crónicas do Véu — ilustrações por local, guardadas na nuvem.
-- Executar após campanhas_companheiros.sql.
alter table public.game_images add column if not exists location_key text;
create unique index if not exists game_images_location_unique
  on public.game_images(room_id,location_key);

-- Bucket privado: nenhum jogador tem acesso de leitura direta.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('game-scenes','game-scenes',false,8388608,array['image/jpeg'])
on conflict(id) do nothing;

-- Estado da geração protege contra pedidos simultâneos.
create table if not exists public.game_scene_jobs(
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  location_key text not null,
  state text not null default 'generating' check(state in ('generating','ready','failed')),
  locked_at timestamptz not null default now(),
  primary key(room_id,location_key)
);
alter table public.game_scene_jobs enable row level security;
revoke all on public.game_scene_jobs from public,anon,authenticated;

create or replace function public.claim_game_scene(p_room_id uuid,p_location_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_claimed boolean;
begin
 if p_location_key !~ '^[a-z0-9-]{2,80}$' then
   raise exception 'Identificador de cenário inválido';
 end if;
 if exists(select 1 from public.game_images where room_id=p_room_id and location_key=p_location_key)
 then return false;end if;
 insert into public.game_scene_jobs(room_id,location_key,state,locked_at)
 values(p_room_id,p_location_key,'generating',now())
 on conflict(room_id,location_key) do update
   set state='generating',locked_at=now()
   where public.game_scene_jobs.state='failed'
      or public.game_scene_jobs.locked_at<now()-interval '90 seconds'
 returning true into v_claimed;
 return coalesce(v_claimed,false);
end;
$$;
revoke all on function public.claim_game_scene(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_game_scene(uuid,text) to service_role;

select id, public from storage.buckets where id='game-scenes';
