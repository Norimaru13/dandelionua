create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  nick text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_nick_lower on accounts (lower(nick));

create table if not exists sessions (
  token uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists page_likes (
  page_id text not null,
  account_id uuid not null references accounts(id) on delete cascade,
  primary key (page_id, account_id)
);

alter table accounts enable row level security;
alter table sessions enable row level security;
alter table page_likes enable row level security;

create or replace function nick_ok(p_nick text)
returns boolean
language sql
immutable
as $$
  select p_nick ~ '^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9_]{3,20}$';
$$;

create or replace function nick_taken(p_nick text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from accounts where lower(nick) = lower(p_nick)
  );
end;
$$;

create or replace function account_register(p_nick text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  tok uuid;
begin
  if not nick_ok(p_nick) then
    return json_build_object('ok', false, 'error', 'bad_nick');
  end if;
  if p_password is null or char_length(p_password) < 6 then
    return json_build_object('ok', false, 'error', 'bad_password');
  end if;
  if exists (select 1 from accounts where lower(nick) = lower(p_nick)) then
    return json_build_object('ok', false, 'error', 'taken');
  end if;

  insert into accounts (nick, password_hash)
  values (p_nick, crypt(p_password, gen_salt('bf')))
  returning id into uid;

  insert into sessions (account_id) values (uid) returning token into tok;
  return json_build_object('ok', true, 'token', tok, 'nick', p_nick);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'taken');
end;
$$;

create or replace function account_login(p_nick text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  acc accounts%rowtype;
  tok uuid;
begin
  select * into acc
  from accounts
  where lower(nick) = lower(p_nick);

  if not found or acc.password_hash <> crypt(p_password, acc.password_hash) then
    return json_build_object('ok', false, 'error', 'bad_login');
  end if;

  insert into sessions (account_id) values (acc.id) returning token into tok;
  return json_build_object('ok', true, 'token', tok, 'nick', acc.nick);
end;
$$;

create or replace function account_logout(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from sessions where token = p_token;
  return json_build_object('ok', true);
end;
$$;

create or replace function account_me(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
begin
  select a.nick into n
  from sessions s
  join accounts a on a.id = s.account_id
  where s.token = p_token;

  if n is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  return json_build_object('ok', true, 'nick', n);
end;
$$;

create or replace function get_likes(p_page text, p_token uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  v_likes int;
  v_liked boolean;
begin
  insert into page_stats (page_id) values (p_page)
  on conflict (page_id) do nothing;

  select likes into v_likes from page_stats where page_id = p_page;

  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    v_liked := false;
  else
    v_liked := exists (
      select 1 from page_likes
      where page_id = p_page and account_id = uid
    );
  end if;

  return json_build_object('ok', true, 'likes', coalesce(v_likes, 0), 'liked', v_liked);
end;
$$;

create or replace function toggle_like_account(p_page text, p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  was boolean;
  v_likes int;
  v_liked boolean;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;

  insert into page_stats (page_id) values (p_page)
  on conflict (page_id) do nothing;

  select exists (
    select 1 from page_likes where page_id = p_page and account_id = uid
  ) into was;

  if was then
    delete from page_likes where page_id = p_page and account_id = uid;
    update page_stats set likes = greatest(likes - 1, 0) where page_id = p_page;
    v_liked := false;
  else
    insert into page_likes (page_id, account_id) values (p_page, uid);
    update page_stats set likes = likes + 1 where page_id = p_page;
    v_liked := true;
  end if;

  select likes into v_likes from page_stats where page_id = p_page;
  return json_build_object('ok', true, 'likes', coalesce(v_likes, 0), 'liked', v_liked);
end;
$$;

grant execute on function nick_taken(text) to anon, authenticated;
grant execute on function account_register(text, text) to anon, authenticated;
grant execute on function account_login(text, text) to anon, authenticated;
grant execute on function account_logout(uuid) to anon, authenticated;
grant execute on function account_me(uuid) to anon, authenticated;
grant execute on function get_likes(text, uuid) to anon, authenticated;
grant execute on function toggle_like_account(text, uuid) to anon, authenticated;
