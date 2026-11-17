-- CRÓNICAS DO VÉU — PERSONAGENS PERMANENTES MULTIJOGADOR
-- Executar no Supabase após os SQL de salas e turnos já aplicados.
-- É idempotente na primeira execução; não altera as fichas das aventuras existentes.

create table if not exists public.game_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 80),
  sheet jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists game_profiles_owner_idx on public.game_profiles(owner_id);
alter table public.game_profiles enable row level security;
revoke all on public.game_profiles from public,anon,authenticated;
grant select,insert,update on public.game_profiles to authenticated;

create policy profiles_owner_read on public.game_profiles
  for select to authenticated using(owner_id=(select auth.uid()));
create policy profiles_owner_insert on public.game_profiles
  for insert to authenticated with check(owner_id=(select auth.uid()));
create policy profiles_owner_update on public.game_profiles
  for update to authenticated using(owner_id=(select auth.uid()))
  with check(owner_id=(select auth.uid()));

-- Referência opcional: uma ficha de sala pode apontar à personagem permanente.
alter table public.game_characters
  add column if not exists profile_id uuid references public.game_profiles(id);

select tablename,rowsecurity from pg_tables
where schemaname='public' and tablename='game_profiles';
