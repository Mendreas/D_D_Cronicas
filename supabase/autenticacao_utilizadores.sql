-- Executar no Supabase SQL Editor antes de ativar a autenticação sem GAME_ACCESS_CODE.
-- Contas novas NÃO ganham acesso automático à API OpenAI.

create table if not exists public.game_authorized_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.game_authorized_users enable row level security;
revoke all on public.game_authorized_users from public,anon,authenticated;
grant usage on schema public to service_role;
grant select on public.game_authorized_users to service_role;

-- Consulta para identificares os emails já registados (apenas no SQL Editor):
select id, email, created_at from auth.users order by created_at desc;

-- AUTORIZAÇÃO: substituir pelos emails que pretendes permitir, mantendo as aspas.
-- Podes incluir o teu e o da tua filha na mesma instrução.
-- Descomentar o bloco após substituir os endereços:
--
-- insert into public.game_authorized_users(user_id)
-- select id from auth.users
-- where lower(email) in (lower('O_TEU_EMAIL@exemplo.pt'), lower('OUTRO_EMAIL@exemplo.pt'))
-- on conflict (user_id) do update set enabled=true;
--
-- Verificar quais ficaram autorizados:
select u.email, a.enabled
from public.game_authorized_users a
join auth.users u on u.id=a.user_id
order by u.email;
