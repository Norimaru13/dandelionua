alter table posts add column if not exists draft boolean not null default false;
alter table posts add column if not exists pending jsonb;

update posts set draft = false where pending is not null;
update posts set draft = false where coalesce(views, 0) > 0 or coalesce(likes, 0) > 0;

drop function if exists list_posts();
drop function if exists list_posts(uuid);
drop function if exists get_post(uuid, uuid);

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
      coalesce(p.draft, false) as draft,
      (adm and p.pending is not null) as has_pending,
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
      coalesce(p.draft, false) as draft,
      case when adm then p.pending else null end as pending,
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
    where p.id = p_id
      and (adm or not coalesce(p.draft, false))
  ) x;

  if rec is null then
    return json_build_object('ok', false, 'error', 'missing');
  end if;
  return json_build_object('ok', true, 'post', rec);
end;
$$;

grant execute on function list_posts(uuid) to anon, authenticated;
grant execute on function get_post(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
