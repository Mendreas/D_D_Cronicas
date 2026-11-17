-- Crónicas do Véu — turnos assíncronos (executar UMA vez no SQL Editor)
-- Requer as cinco tabelas game_* e private.is_game_member do passo anterior.

create table if not exists public.game_turns (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  turn_number integer not null default 1 check (turn_number >= 1),
  status text not null default 'collecting' check (status in ('collecting','resolving')),
  updated_at timestamptz not null default now()
);
create table if not exists public.game_turn_members (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  turn_number integer not null check (turn_number >= 1),
  user_id uuid not null references auth.users(id),
  ready boolean not null default false,
  primary key(room_id,turn_number,user_id)
);
create table if not exists public.game_turn_actions (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  turn_number integer not null check (turn_number >= 1),
  user_id uuid not null references auth.users(id),
  content text not null check (char_length(content) between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key(room_id,turn_number,user_id),
  foreign key(room_id,turn_number,user_id)
    references public.game_turn_members(room_id,turn_number,user_id)
    on delete cascade
);

alter table public.game_turns enable row level security;
alter table public.game_turn_members enable row level security;
alter table public.game_turn_actions enable row level security;
revoke all on public.game_turns,public.game_turn_members,public.game_turn_actions from public,anon,authenticated;
grant select on public.game_turns,public.game_turn_members,public.game_turn_actions to authenticated;

create policy "turns_read_members" on public.game_turns
  for select to authenticated using (private.is_game_member(room_id));
create policy "turn_members_read_members" on public.game_turn_members
  for select to authenticated using (private.is_game_member(room_id));
create policy "turn_actions_read_own" on public.game_turn_actions
  for select to authenticated using (
    user_id=(select auth.uid()) and private.is_game_member(room_id)
  );

-- Anfitrião inicia a aventura apenas com pelo menos 2 jogadores.
create or replace function public.start_game_turns(p_room_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_total integer;
begin
  if auth.uid() is null then raise exception 'Inicia sessão primeiro'; end if;
  select owner_id into v_owner from public.game_rooms where id=p_room_id for update;
  if v_owner is distinct from auth.uid() then raise exception 'Só o anfitrião pode iniciar a aventura'; end if;
  select count(*) into v_total from public.game_players where room_id=p_room_id;
  if v_total<2 then raise exception 'Aguarda pela entrada de pelo menos dois jogadores'; end if;
  if exists(select 1 from public.game_turns where room_id=p_room_id) then
    raise exception 'Esta aventura já começou';
  end if;
  insert into public.game_turns(room_id) values(p_room_id);
  insert into public.game_turn_members(room_id,turn_number,user_id)
    select p_room_id,1,user_id from public.game_players where room_id=p_room_id;
end;
$$;

-- Cada jogador envia uma ação por turno; pode alterá-la enquanto a IA não iniciou.
create or replace function public.submit_game_turn(p_room_id uuid,p_content text)
returns void language plpgsql security definer set search_path='' as $$
declare v_turn integer; v_status text;
begin
  if auth.uid() is null then raise exception 'Inicia sessão primeiro'; end if;
  if char_length(trim(coalesce(p_content,''))) not between 1 and 5000 then
    raise exception 'Escreve uma ação até 5000 caracteres';
  end if;
  select turn_number,status into v_turn,v_status
  from public.game_turns where room_id=p_room_id for update;
  if not found then raise exception 'A sala ainda não começou'; end if;
  if v_status<>'collecting' then raise exception 'O Mestre está a resolver este turno'; end if;
  if not exists (
    select 1 from public.game_turn_members
    where room_id=p_room_id and turn_number=v_turn and user_id=auth.uid()
  ) then raise exception 'Não participas neste turno; entras no próximo'; end if;
  insert into public.game_turn_actions(room_id,turn_number,user_id,content)
  values(p_room_id,v_turn,auth.uid(),trim(p_content))
  on conflict (room_id,turn_number,user_id) do update
    set content=excluded.content,updated_at=now();
  update public.game_turn_members set ready=true
  where room_id=p_room_id and turn_number=v_turn and user_id=auth.uid();
end;
$$;

-- Estas três funções são exclusivamente para a função Netlify com chave secreta.
create or replace function public.claim_game_turn(p_room_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_turn integer; v_status text; v_count integer; v_ready integer;
begin
  select turn_number,status into v_turn,v_status
    from public.game_turns where room_id=p_room_id for update;
  if not found or v_status<>'collecting' then raise exception 'Turno não disponível'; end if;
  select count(*),count(*) filter (where ready)
    into v_count,v_ready from public.game_turn_members
    where room_id=p_room_id and turn_number=v_turn;
  if v_count<2 or v_ready<>v_count then raise exception 'Ainda faltam decisões de jogadores'; end if;
  update public.game_turns set status='resolving',updated_at=now() where room_id=p_room_id;
  return v_turn;
end;
$$;

create or replace function public.finish_game_turn(p_room_id uuid,p_turn_number integer,p_story text)
returns void language plpgsql security definer set search_path='' as $$
declare v_turn integer;v_status text;
begin
  if char_length(trim(coalesce(p_story,''))) not between 1 and 12000 then
    raise exception 'Narração inválida';
  end if;
  select turn_number,status into v_turn,v_status
    from public.game_turns where room_id=p_room_id for update;
  if v_turn is distinct from p_turn_number or v_status<>'resolving' then
    raise exception 'Turno já resolvido ou inválido';
  end if;
  insert into public.game_messages(room_id,author_id,role,content)
    values(p_room_id,null,'gm',trim(p_story));
  update public.game_turns set turn_number=v_turn+1,status='collecting',updated_at=now()
    where room_id=p_room_id;
  insert into public.game_turn_members(room_id,turn_number,user_id)
    select p_room_id,v_turn+1,user_id from public.game_players where room_id=p_room_id;
end;
$$;

create or replace function public.abort_game_turn(p_room_id uuid,p_turn_number integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.game_turns set status='collecting',updated_at=now()
  where room_id=p_room_id and turn_number=p_turn_number and status='resolving';
end;
$$;

revoke all on function public.start_game_turns(uuid),public.submit_game_turn(uuid,text),
  public.claim_game_turn(uuid),public.finish_game_turn(uuid,integer,text),
  public.abort_game_turn(uuid,integer) from public,anon,authenticated;
grant execute on function public.start_game_turns(uuid),public.submit_game_turn(uuid,text)
  to authenticated;
grant execute on function public.claim_game_turn(uuid),
  public.finish_game_turn(uuid,integer,text),public.abort_game_turn(uuid,integer)
  to service_role;

-- Realtime (duplicados evitados).
do $$ begin
 if not exists(
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='game_turns'
 ) then alter publication supabase_realtime add table public.game_turns; end if;
 if not exists(
  select 1 from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='game_turn_members'
 ) then alter publication supabase_realtime add table public.game_turn_members; end if;
end $$;

select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename in ('game_turns','game_turn_members','game_turn_actions')
order by tablename;
