alter table posts add column if not exists pending jsonb;

drop function if exists list_posts();
drop function if exists list_posts(uuid);
drop function if exists update_post(uuid, uuid, text, text, text, text, json);
drop function if exists update_post(uuid, uuid, text, text, text, text, json, text);
drop function if exists update_post(uuid, uuid, text, text, text, text, json, text, text, text);
drop function if exists update_post(uuid, uuid, text, text, text, text, json, text, text, text, json, json);
drop function if exists update_post(uuid, uuid, text, text, text, text, json, text, text, text, json, json, boolean);

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
    where adm or not coalesce(p.draft, false)
    order by p.created_at desc
  ) x;
  return json_build_object('ok', true, 'posts', result);
end;
$$;

create or replace function update_post(
  p_token uuid,
  p_id uuid,
  p_title_en text,
  p_title_ua text,
  p_body_en text,
  p_body_ua text,
  p_photos json,
  p_kind text default null,
  p_lead_en text default null,
  p_lead_ua text default null,
  p_meta json default null,
  p_preview json default null,
  p_draft boolean default null,
  p_pending json default null
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
  k text;
  pmime text;
  pdata text;
  is_draft boolean;
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

  select coalesce(draft, false) into is_draft from posts where id = p_id;

  if p_pending is not null and json_typeof(p_pending) = 'object' and not is_draft and p_draft is not true then
    update posts set pending = p_pending::jsonb where id = p_id;
    return json_build_object('ok', true, 'id', p_id);
  end if;

  k := case
    when p_kind = 'publication' then 'publication'
    when p_kind = 'project' then 'project'
    else null
  end;

  update posts set
    title_en = coalesce(p_title_en, ''),
    title_ua = coalesce(p_title_ua, ''),
    body_en = coalesce(p_body_en, ''),
    body_ua = coalesce(p_body_ua, ''),
    lead_en = coalesce(p_lead_en, lead_en),
    lead_ua = coalesce(p_lead_ua, lead_ua),
    kind = coalesce(k, kind),
    meta = coalesce(p_meta::jsonb, meta),
    draft = coalesce(p_draft, draft),
    pending = null
  where id = p_id;

  if p_preview is not null then
    pmime := coalesce(p_preview->>'mime', '');
    pdata := coalesce(p_preview->>'data', '');
    if pmime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
       and char_length(pdata) >= 20 and char_length(pdata) <= 900000 then
      update posts set preview_mime = pmime, preview_data = pdata where id = p_id;
    end if;
  end if;

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

grant execute on function list_posts(uuid) to anon, authenticated;
grant execute on function update_post(uuid, uuid, text, text, text, text, json, text, text, text, json, json, boolean, json) to anon, authenticated;
