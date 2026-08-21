alter table posts add column if not exists dislikes int not null default 0;
alter table posts add column if not exists draft boolean not null default false;
alter table posts add column if not exists pending jsonb;

create table if not exists post_dislikes (
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  primary key (post_id, account_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  body text not null,
  likes int not null default 0,
  dislikes int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists comment_votes (
  comment_id uuid not null references comments(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  primary key (comment_id, account_id)
);

alter table post_dislikes enable row level security;
alter table comments enable row level security;
alter table comment_votes enable row level security;

drop function if exists list_posts();
drop function if exists list_posts(uuid);
drop function if exists get_post(uuid, uuid);
drop function if exists toggle_post_like(uuid, uuid);
drop function if exists toggle_post_dislike(uuid, uuid);
drop function if exists list_comments(uuid, uuid);
drop function if exists add_comment(uuid, uuid, text);
drop function if exists toggle_comment_vote(uuid, uuid, smallint);
drop function if exists toggle_comment_vote(uuid, uuid, integer);

create or replace function list_posts(p_token uuid default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result json;
  uid uuid;
  adm boolean := false;
begin
  if p_token is not null then
    select s.account_id, coalesce(a.is_admin, false)
    into uid, adm
    from sessions s
    join accounts a on a.id = s.account_id
    where s.token = p_token;
  end if;

  select coalesce(json_agg(row_to_json(x)), '[]'::json)
  into result
  from (
    select
      p.id,
      p.kind,
      p.title_en,
      p.title_ua,
      p.lead_en,
      p.lead_ua,
      p.body_en,
      p.body_ua,
      p.meta,
      p.preview_mime,
      p.preview_data,
      p.created_at,
      p.views,
      p.likes,
      coalesce(p.dislikes, 0) as dislikes,
      coalesce(p.draft, false) as draft,
      (adm and p.pending is not null) as has_pending,
      exists (
        select 1 from post_likes pl
        where pl.post_id = p.id and pl.account_id = uid
      ) as liked,
      exists (
        select 1 from post_dislikes pd
        where pd.post_id = p.id and pd.account_id = uid
      ) as disliked,
      (
        select count(*) from comments c where c.post_id = p.id
      ) as comment_count,
      (
        select json_build_object(
          'id', c.id,
          'body', c.body,
          'nick', a.nick,
          'likes', c.likes
        )
        from comments c
        join accounts a on a.id = c.account_id
        where c.post_id = p.id
        order by c.likes desc, c.created_at desc
        limit 1
      ) as top_comment,
      (
        select coalesce(json_agg(json_build_object(
          'mime', ph.mime,
          'data', ph.data
        ) order by ph.sort), '[]'::json)
        from post_photos ph
        where ph.post_id = p.id
      ) as photos
    from posts p
    where adm or not coalesce(p.draft, false)
    order by p.created_at desc
  ) x;
  return json_build_object('ok', true, 'posts', result);
end;
$$;

create or replace function get_post(p_token uuid, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  adm boolean := false;
  rec json;
begin
  if p_token is not null then
    select s.account_id, coalesce(a.is_admin, false)
    into uid, adm
    from sessions s
    join accounts a on a.id = s.account_id
    where s.token = p_token;
  end if;

  select row_to_json(x) into rec
  from (
    select
      p.id,
      p.kind,
      p.title_en,
      p.title_ua,
      p.lead_en,
      p.lead_ua,
      p.body_en,
      p.body_ua,
      p.meta,
      p.preview_mime,
      p.preview_data,
      p.created_at,
      p.views,
      p.likes,
      coalesce(p.dislikes, 0) as dislikes,
      coalesce(p.draft, false) as draft,
      case when adm then p.pending else null end as pending,
      exists (
        select 1 from post_likes pl
        where pl.post_id = p.id and pl.account_id = uid
      ) as liked,
      exists (
        select 1 from post_dislikes pd
        where pd.post_id = p.id and pd.account_id = uid
      ) as disliked
    from posts p
    where p.id = p_id
      and (adm or not coalesce(p.draft, false))
  ) x;

  if rec is null then
    return json_build_object('ok', false, 'error', 'missing');
  end if;
  return json_build_object('ok', true, 'post', rec);
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
  had_down boolean;
  v_likes int;
  v_dislikes int;
  v_liked boolean;
  v_disliked boolean;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;

  select exists (select 1 from post_likes where post_id = p_post and account_id = uid) into was;
  select exists (select 1 from post_dislikes where post_id = p_post and account_id = uid) into had_down;

  if was then
    delete from post_likes where post_id = p_post and account_id = uid;
    update posts set likes = greatest(likes - 1, 0) where id = p_post;
    v_liked := false;
  else
    if had_down then
      delete from post_dislikes where post_id = p_post and account_id = uid;
      update posts set dislikes = greatest(dislikes - 1, 0) where id = p_post;
    end if;
    insert into post_likes (post_id, account_id) values (p_post, uid);
    update posts set likes = likes + 1 where id = p_post;
    v_liked := true;
  end if;

  select likes, coalesce(dislikes, 0) into v_likes, v_dislikes from posts where id = p_post;
  select exists (select 1 from post_dislikes where post_id = p_post and account_id = uid) into v_disliked;
  return json_build_object('ok', true, 'likes', coalesce(v_likes, 0), 'dislikes', coalesce(v_dislikes, 0), 'liked', v_liked, 'disliked', v_disliked);
end;
$$;

create or replace function toggle_post_dislike(p_post uuid, p_token uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  was boolean;
  had_up boolean;
  v_likes int;
  v_dislikes int;
  v_liked boolean;
  v_disliked boolean;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;

  select exists (select 1 from post_dislikes where post_id = p_post and account_id = uid) into was;
  select exists (select 1 from post_likes where post_id = p_post and account_id = uid) into had_up;

  if was then
    delete from post_dislikes where post_id = p_post and account_id = uid;
    update posts set dislikes = greatest(dislikes - 1, 0) where id = p_post;
    v_disliked := false;
  else
    if had_up then
      delete from post_likes where post_id = p_post and account_id = uid;
      update posts set likes = greatest(likes - 1, 0) where id = p_post;
    end if;
    insert into post_dislikes (post_id, account_id) values (p_post, uid);
    update posts set dislikes = coalesce(dislikes, 0) + 1 where id = p_post;
    v_disliked := true;
  end if;

  select likes, coalesce(dislikes, 0) into v_likes, v_dislikes from posts where id = p_post;
  select exists (select 1 from post_likes where post_id = p_post and account_id = uid) into v_liked;
  return json_build_object('ok', true, 'likes', coalesce(v_likes, 0), 'dislikes', coalesce(v_dislikes, 0), 'liked', v_liked, 'disliked', v_disliked);
end;
$$;

create or replace function list_comments(p_post uuid, p_token uuid default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  result json;
begin
  if p_token is not null then
    select s.account_id into uid from sessions s where s.token = p_token;
  end if;

  select coalesce(json_agg(row_to_json(x)), '[]'::json)
  into result
  from (
    select
      c.id,
      c.body,
      c.likes,
      c.dislikes,
      c.created_at,
      a.nick,
      (uid is not null and exists (
        select 1 from comment_votes v
        where v.comment_id = c.id and v.account_id = uid and v.vote = 1
      )) as liked,
      (uid is not null and exists (
        select 1 from comment_votes v
        where v.comment_id = c.id and v.account_id = uid and v.vote = -1
      )) as disliked
    from comments c
    join accounts a on a.id = c.account_id
    where c.post_id = p_post
    order by c.created_at desc
  ) x;
  return json_build_object('ok', true, 'comments', result);
end;
$$;

create or replace function add_comment(p_token uuid, p_post uuid, p_body text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  cid uuid;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    return json_build_object('ok', false, 'error', 'empty_post');
  end if;
  if not exists (select 1 from posts where id = p_post and not coalesce(draft, false)) then
    return json_build_object('ok', false, 'error', 'missing');
  end if;

  insert into comments (post_id, account_id, body)
  values (p_post, uid, p_body)
  returning id into cid;

  return json_build_object('ok', true, 'id', cid);
end;
$$;

create or replace function toggle_comment_vote(p_token uuid, p_comment uuid, p_vote integer)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
  cur smallint;
  want smallint;
  v_likes int;
  v_dislikes int;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if p_vote >= 0 then want := 1; else want := -1; end if;

  select vote into cur from comment_votes where comment_id = p_comment and account_id = uid;

  if cur is not null and cur = want then
    delete from comment_votes where comment_id = p_comment and account_id = uid;
    if want = 1 then
      update comments set likes = greatest(likes - 1, 0) where id = p_comment;
    else
      update comments set dislikes = greatest(dislikes - 1, 0) where id = p_comment;
    end if;
  else
    if cur is not null then
      delete from comment_votes where comment_id = p_comment and account_id = uid;
      if cur = 1 then
        update comments set likes = greatest(likes - 1, 0) where id = p_comment;
      else
        update comments set dislikes = greatest(dislikes - 1, 0) where id = p_comment;
      end if;
    end if;
    insert into comment_votes (comment_id, account_id, vote) values (p_comment, uid, want);
    if want = 1 then
      update comments set likes = likes + 1 where id = p_comment;
    else
      update comments set dislikes = dislikes + 1 where id = p_comment;
    end if;
  end if;

  select likes, dislikes into v_likes, v_dislikes from comments where id = p_comment;
  return json_build_object(
    'ok', true,
    'likes', coalesce(v_likes, 0),
    'dislikes', coalesce(v_dislikes, 0),
    'liked', exists (select 1 from comment_votes where comment_id = p_comment and account_id = uid and vote = 1),
    'disliked', exists (select 1 from comment_votes where comment_id = p_comment and account_id = uid and vote = -1)
  );
end;
$$;

grant execute on function list_posts(uuid) to anon, authenticated;
grant execute on function get_post(uuid, uuid) to anon, authenticated;
grant execute on function toggle_post_like(uuid, uuid) to anon, authenticated;
grant execute on function toggle_post_dislike(uuid, uuid) to anon, authenticated;
grant execute on function list_comments(uuid, uuid) to anon, authenticated;
grant execute on function add_comment(uuid, uuid, text) to anon, authenticated;
grant execute on function toggle_comment_vote(uuid, uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';
