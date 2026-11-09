-- Run once in Supabase SQL Editor. Re-running preserves existing accounts.
begin;
create table if not exists public.marketing_users (
  id text primary key,
  name text not null,
  email text not null unique check (email = lower(email)),
  role text not null check (role in ('admin', 'coordinator', 'marketing')),
  password_hash text not null check (password_hash ~ '^scrypt\$32768\$8\$1\$[a-f0-9]{64}\$[a-f0-9]{128}$')
);
create table if not exists public.marketing_sessions (
  sid text primary key,
  value jsonb,
  revoked boolean not null default false,
  expires_at timestamptz not null
);
create index if not exists marketing_sessions_expiry on public.marketing_sessions (expires_at);
create table if not exists public.marketing_limits (
  key text primary key,
  hits integer not null,
  reset_at timestamptz not null
);
alter table public.marketing_users enable row level security;
alter table public.marketing_sessions enable row level security;
alter table public.marketing_limits enable row level security;
revoke all on public.marketing_users, public.marketing_sessions, public.marketing_limits from public, anon, authenticated;
grant select, insert, update, delete on public.marketing_users, public.marketing_sessions, public.marketing_limits to service_role;

create or replace function public.marketing_update_account(p_id text, p_old_hash text, p_email text, p_new_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.marketing_users set email = p_email, password_hash = p_new_hash
  where id = p_id and password_hash = p_old_hash;
  return found;
end;
$$;

-- Tombstones prevent an in-flight request on another instance from restoring a logged-out session.
create or replace function public.marketing_session(p_op text, p_sid text, p_value jsonb, p_ttl_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; expiry timestamptz;
begin
  if p_ttl_seconds < 1 or p_ttl_seconds > 86400 or length(p_sid) <> 64 then
    raise exception 'Invalid session parameters';
  end if;
  expiry := now() + make_interval(secs => p_ttl_seconds);
  if p_op = 'get' then
    select value into result from public.marketing_sessions
      where sid = p_sid and not revoked and expires_at > now();
    return result;
  elsif p_op = 'destroy' then
    insert into public.marketing_sessions(sid, value, revoked, expires_at) values (p_sid, null, true, expiry)
      on conflict(sid) do update set value = null, revoked = true, expires_at = greatest(public.marketing_sessions.expires_at, excluded.expires_at);
  elsif p_op = 'set' then
    if p_value is null or jsonb_typeof(p_value) <> 'object' then raise exception 'Invalid session'; end if;
    insert into public.marketing_sessions(sid, value, revoked, expires_at) values(p_sid, p_value, false, expiry)
      on conflict(sid) do update set value = excluded.value, expires_at = excluded.expires_at
      where not public.marketing_sessions.revoked;
  elsif p_op = 'touch' then
    update public.marketing_sessions set expires_at = expiry
      where sid = p_sid and not revoked and expires_at > now();
  else
    raise exception 'Invalid session operation';
  end if;
  delete from public.marketing_sessions where expires_at < now() - interval '1 day';
  return null;
end;
$$;

create or replace function public.marketing_rate_limit(p_key text, p_window_ms integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_window_ms < 1 or p_window_ms > 86400000 or length(p_key) <> 64 then raise exception 'Invalid limit'; end if;
  insert into public.marketing_limits(key, hits, reset_at)
    values(p_key, 1, now() + p_window_ms * interval '1 millisecond')
  on conflict(key) do update set
    hits = case when public.marketing_limits.reset_at <= now() then 1 else public.marketing_limits.hits + 1 end,
    reset_at = case when public.marketing_limits.reset_at <= now() then excluded.reset_at else public.marketing_limits.reset_at end
  returning jsonb_build_object('hits', hits, 'reset_at', reset_at) into result;
  delete from public.marketing_limits where reset_at < now() - interval '1 day';
  return result;
end;
$$;

revoke all on function public.marketing_update_account(text,text,text,text) from public, anon, authenticated;
revoke all on function public.marketing_session(text,text,jsonb,integer) from public, anon, authenticated;
revoke all on function public.marketing_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.marketing_update_account(text,text,text,text) to service_role;
grant execute on function public.marketing_session(text,text,jsonb,integer) to service_role;
grant execute on function public.marketing_rate_limit(text,integer) to service_role;
commit;
notify pgrst, 'reload schema';
