-- Crónicas do Véu — campanhas e companheiros do grupo.
-- Executar depois de turnos_assincronos.sql.
alter table public.game_rooms
  add column if not exists campaign_id text not null default 'veu',
  add column if not exists campaign_intro text not null default '';

create table if not exists public.game_companions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 80),
  archetype text not null check(char_length(archetype) between 1 and 80),
  sheet jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(room_id,name)
);
alter table public.game_companions enable row level security;
revoke all on public.game_companions from public,anon,authenticated;
grant select on public.game_companions to authenticated;
create policy companions_read on public.game_companions
  for select to authenticated using(private.is_game_member(room_id));

create or replace function public.create_campaign_room(
 p_title text,p_player_name text,p_campaign_id text,p_campaign_intro text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_room uuid;v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'É necessário iniciar sessão'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 1 and 120
 or char_length(trim(coalesce(p_player_name,''))) not between 1 and 60
 then raise exception 'Nome de sala ou jogador inválido'; end if;
 if p_campaign_id not in ('veu','farol','estrelas') then raise exception 'Campanha não reconhecida';end if;
 insert into public.game_rooms(title,owner_id,campaign_id,campaign_intro)
 values(trim(p_title),v_user,p_campaign_id,left(coalesce(p_campaign_intro,''),1500))
 returning id into v_room;
 insert into public.game_players(room_id,user_id,display_name) values(v_room,v_user,trim(p_player_name));
 insert into public.game_companions(room_id,name,archetype,sheet) values
 (v_room,'Kael','Guerreiro', '{"nivel":1,"pv":12,"papeis":["proteção","combate"]}'::jsonb),
 (v_room,'Lyra','Clériga', '{"nivel":1,"pv":10,"papeis":["cura","sabedoria"]}'::jsonb);
 return v_room;
end;
$$;

-- No máximo dois jogadores humanos na mesma sala; sem entradas depois de começar.
create or replace function public.join_game_room(
 p_invite_code text,p_player_name text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_room uuid; v_started boolean; v_user uuid:=auth.uid(); v_count integer;
begin
 if v_user is null then raise exception 'É necessário iniciar sessão'; end if;
 if coalesce(p_invite_code,'') !~ '^[A-Za-z0-9]{12}$'
 or char_length(trim(coalesce(p_player_name,''))) not between 1 and 60
 then raise exception 'Convite ou nome inválido'; end if;
 select id into v_room from public.game_rooms
 where invite_code=upper(p_invite_code) for update;
 if v_room is null then raise exception 'Código de convite inválido'; end if;
 if exists(select 1 from public.game_players where room_id=v_room and user_id=v_user)
 then return v_room; end if;
 select count(*) into v_count from public.game_players where room_id=v_room;
 if v_count>=2 then raise exception 'Esta sala já tem dois jogadores humanos'; end if;
 select exists(select 1 from public.game_turns where room_id=v_room) into v_started;
 if v_started then raise exception 'Esta aventura já começou'; end if;
 insert into public.game_players(room_id,user_id,display_name)
 values(v_room,v_user,trim(p_player_name));
 return v_room;
end;
$$;
revoke all on function public.create_campaign_room(text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_campaign_room(text,text,text,text) to authenticated;

select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename='game_companions';
