-- ============================================================
-- Acceso propio (invitaciones y recuperación con vigencia de 5 días),
-- baja de usuarios y revisión de sus registros.
-- Correr UNA vez en el SQL Editor de Supabase. Es seguro repetirlo.
-- ============================================================

-- 1) Tokens de acceso: link + código de 6 dígitos (solo se guardan hashes).
create table if not exists access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  purpose text not null check (purpose in ('invite', 'recovery')),
  token_hash text not null unique,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists access_tokens_email_idx on access_tokens(email, created_at desc);
alter table access_tokens enable row level security; -- sin policies: solo el service role

-- 2) Bajas de usuarios: qué se movió y qué falta revisar.
create table if not exists user_removals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  full_name text,
  role text,
  removed_by uuid,
  removed_at timestamptz not null default now(),
  moved jsonb not null default '{}'::jsonb,
  status text not null default 'pendiente' check (status in ('pendiente', 'revisada')),
  reviewed_at timestamptz
);
create index if not exists user_removals_status_idx on user_removals(status);
alter table user_removals enable row level security; -- sin policies: solo el service role

-- 3) Baja atómica: traspasa TODO lo que apunta al usuario y lo elimina.
--    Busca solas las llaves foráneas hacia profiles/auth.users, así que no
--    depende de saber en qué tablas aparece (incluye las que borrarían en cascada,
--    como visit_assignments.assigned_to, para no perder el historial). Las visitas y asignaciones pasan
--    a p_new_owner (Master Chef); los NEGOCIOS (clients.created_by) quedan
--    sin dueño para que Master Chef decida uno por uno.
create or replace function public.remove_user(p_user uuid, p_new_owner uuid, p_removed_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  prof public.profiles%rowtype;
  fk record;
  moved jsonb := '{}'::jsonb;
  ids jsonb;
  has_id boolean;
  new_val uuid;
  removal_id uuid;
begin
  select * into prof from public.profiles where id = p_user;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  if p_user = p_new_owner then
    raise exception 'El destino de los registros no puede ser el mismo usuario';
  end if;

  for fk in
    select n.nspname as sch, cl.relname as tbl, a.attname as col
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and n.nspname = 'public'
      and cl.relname not in ('profiles', 'access_tokens', 'user_removals', 'alert_dismissals')
  loop
    has_id := exists (
      select 1 from information_schema.columns
      where table_schema = fk.sch and table_name = fk.tbl and column_name = 'id'
    );
    if fk.tbl = 'clients' and fk.col = 'created_by' then
      new_val := null;
    else
      new_val := p_new_owner;
    end if;

    if has_id then
      execute format(
        'with u as (update %I.%I set %I = $1 where %I = $2 returning id) select coalesce(jsonb_agg(id), ''[]''::jsonb) from u',
        fk.sch, fk.tbl, fk.col, fk.col
      ) into ids using new_val, p_user;
    else
      execute format('update %I.%I set %I = $1 where %I = $2', fk.sch, fk.tbl, fk.col, fk.col) using new_val, p_user;
      ids := '[]'::jsonb;
    end if;

    if jsonb_array_length(ids) > 0 then
      moved := moved || jsonb_build_object(fk.tbl || '.' || fk.col, ids);
    end if;
  end loop;

  insert into public.user_removals (user_id, email, full_name, role, removed_by, moved)
  values (p_user, prof.email, prof.full_name, prof.role, p_removed_by, moved)
  returning id into removal_id;

  delete from auth.users where id = p_user; -- en cascada: perfil, identidades, sesiones, tokens

  return jsonb_build_object('removal_id', removal_id, 'moved', moved);
end;
$$;

revoke all on function public.remove_user(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_user(uuid, uuid, uuid) to service_role;
