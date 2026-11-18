-- CRÓNICAS DO VÉU — SINCRONIZAÇÃO PRIVADA DE FICHAS E AVENTURAS
-- Executar uma vez no SQL Editor do Supabase ANTES de esperar recuperar
-- campanhas entre PC e telemóvel.
create table if not exists public.game_player_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.game_player_state enable row level security;
revoke all on public.game_player_state from public, anon, authenticated;
-- O acesso é feito APENAS por uma função Netlify autenticada (service role),
-- que consulta/atualiza exclusivamente a linha do utilizador da sessão.
create index if not exists game_player_state_updated_idx on public.game_player_state(updated_at);
