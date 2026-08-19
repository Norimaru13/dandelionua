alter table accounts add column if not exists is_admin boolean not null default false;

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title_en text not null default '',
  title_ua text not null default '',
  body_en text not null default '',
  body_ua text not null default '',
  created_at timestamptz not null default now(),
  author_id uuid references accounts(id)
);

create table if not exists post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  mime text not null,
  data text not null,
  sort int not null default 0
);

alter table posts enable row level security;
alter table post_photos enable row level security;

create or replace function account_register(p_nick text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
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
  values (p_nick, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning id into uid;

  insert into sessions (account_id) values (uid) returning token into tok;
  return json_build_object('ok', true, 'token', tok, 'nick', p_nick, 'is_admin', false);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'taken');
end;
$$;

create or replace function account_login(p_nick text, p_password text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  acc accounts%rowtype;
  tok uuid;
begin
  select * into acc
  from accounts
  where lower(nick) = lower(p_nick);

  if not found or acc.password_hash <> extensions.crypt(p_password, acc.password_hash) then
    return json_build_object('ok', false, 'error', 'bad_login');
  end if;

  insert into sessions (account_id) values (acc.id) returning token into tok;
  return json_build_object('ok', true, 'token', tok, 'nick', acc.nick, 'is_admin', acc.is_admin);
end;
$$;

create or replace function account_me(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n text;
  adm boolean;
begin
  select a.nick, a.is_admin into n, adm
  from sessions s
  join accounts a on a.id = s.account_id
  where s.token = p_token;

  if n is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  return json_build_object('ok', true, 'nick', n, 'is_admin', coalesce(adm, false));
end;
$$;

create or replace function list_posts()
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(x)), '[]'::json)
  into result
  from (
    select
      p.id,
      p.title_en,
      p.title_ua,
      p.body_en,
      p.body_ua,
      p.created_at,
      (
        select coalesce(json_agg(json_build_object(
          'mime', ph.mime,
          'data', ph.data
        ) order by ph.sort), '[]'::json)
        from post_photos ph
        where ph.post_id = p.id
      ) as photos
    from posts p
    order by p.created_at desc
  ) x;
  return json_build_object('ok', true, 'posts', result);
end;
$$;

create or replace function create_post(
  p_token uuid,
  p_title_en text,
  p_title_ua text,
  p_body_en text,
  p_body_ua text,
  p_photos json
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  adm boolean;
  pid uuid;
  photo json;
  i int := 0;
  mime text;
  data text;
begin
  select a.id, a.is_admin into uid, adm
  from sessions s
  join accounts a on a.id = s.account_id
  where s.token = p_token;

  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if not coalesce(adm, false) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  if coalesce(trim(p_title_en), '') = '' and coalesce(trim(p_title_ua), '') = '' then
    return json_build_object('ok', false, 'error', 'empty_post');
  end if;

  insert into posts (title_en, title_ua, body_en, body_ua, author_id)
  values (
    coalesce(p_title_en, ''),
    coalesce(p_title_ua, ''),
    coalesce(p_body_en, ''),
    coalesce(p_body_ua, ''),
    uid
  )
  returning id into pid;

  if p_photos is not null and json_typeof(p_photos) = 'array' then
    for photo in select value from json_array_elements(p_photos)
    loop
      if i >= 4 then
        exit;
      end if;
      mime := coalesce(photo->>'mime', '');
      data := coalesce(photo->>'data', '');
      if mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then
        continue;
      end if;
      if char_length(data) < 20 or char_length(data) > 900000 then
        continue;
      end if;
      insert into post_photos (post_id, mime, data, sort)
      values (pid, mime, data, i);
      i := i + 1;
    end loop;
  end if;

  return json_build_object('ok', true, 'id', pid);
end;
$$;

grant execute on function list_posts() to anon, authenticated;
grant execute on function create_post(uuid, text, text, text, text, json) to anon, authenticated;

-- Після цього файлу виконай один рядок зі своїм ніком:
-- update accounts set is_admin = true where lower(nick) = 'твій_нік';
