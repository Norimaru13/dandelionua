alter table posts add column if not exists views int not null default 0;
alter table posts add column if not exists likes int not null default 0;

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  primary key (post_id, account_id)
);

create table if not exists post_views (
  post_id uuid not null references posts(id) on delete cascade,
  visitor_id text not null,
  primary key (post_id, visitor_id)
);

alter table post_likes enable row level security;
alter table post_views enable row level security;

drop function if exists list_posts();
drop function if exists list_posts(uuid);

create or replace function list_posts(p_token uuid default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result json;
  uid uuid;
begin
  select s.account_id into uid from sessions s where s.token = p_token;

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
      p.views,
      p.likes,
      exists (
        select 1 from post_likes pl
        where pl.post_id = p.id and pl.account_id = uid
      ) as liked,
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

create or replace function record_post_view(p_post uuid, p_visitor text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_views int;
begin
  if p_visitor is null or char_length(p_visitor) < 8 then
    select views into v_views from posts where id = p_post;
    return json_build_object('ok', true, 'views', coalesce(v_views, 0));
  end if;

  insert into post_views (post_id, visitor_id)
  values (p_post, p_visitor)
  on conflict do nothing;

  if found then
    update posts set views = views + 1 where id = p_post;
  end if;

  select views into v_views from posts where id = p_post;
  return json_build_object('ok', true, 'views', coalesce(v_views, 0));
end;
$$;

create or replace function toggle_post_like(p_post uuid, p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
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

  select exists (
    select 1 from post_likes where post_id = p_post and account_id = uid
  ) into was;

  if was then
    delete from post_likes where post_id = p_post and account_id = uid;
    update posts set likes = greatest(likes - 1, 0) where id = p_post;
    v_liked := false;
  else
    insert into post_likes (post_id, account_id) values (p_post, uid);
    update posts set likes = likes + 1 where id = p_post;
    v_liked := true;
  end if;

  select likes into v_likes from posts where id = p_post;
  return json_build_object('ok', true, 'likes', coalesce(v_likes, 0), 'liked', v_liked);
end;
$$;

create or replace function update_post(
  p_token uuid,
  p_id uuid,
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
  if not exists (select 1 from posts where id = p_id) then
    return json_build_object('ok', false, 'error', 'missing');
  end if;
  if coalesce(trim(p_title_en), '') = '' and coalesce(trim(p_title_ua), '') = '' then
    return json_build_object('ok', false, 'error', 'empty_post');
  end if;

  update posts set
    title_en = coalesce(p_title_en, ''),
    title_ua = coalesce(p_title_ua, ''),
    body_en = coalesce(p_body_en, ''),
    body_ua = coalesce(p_body_ua, '')
  where id = p_id;

  if p_photos is not null and json_typeof(p_photos) = 'array' then
    delete from post_photos where post_id = p_id;
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
      values (p_id, mime, data, i);
      i := i + 1;
    end loop;
  end if;

  return json_build_object('ok', true, 'id', p_id);
end;
$$;

create or replace function delete_post(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  adm boolean;
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

  delete from posts where id = p_id;
  return json_build_object('ok', true);
end;
$$;

grant execute on function list_posts(uuid) to anon, authenticated;
grant execute on function record_post_view(uuid, text) to anon, authenticated;
grant execute on function toggle_post_like(uuid, uuid) to anon, authenticated;
grant execute on function update_post(uuid, uuid, text, text, text, text, json) to anon, authenticated;
grant execute on function delete_post(uuid, uuid) to anon, authenticated;
