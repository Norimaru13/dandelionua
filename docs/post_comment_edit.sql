alter table comments add column if not exists updated_at timestamptz;

drop function if exists list_comments(uuid, uuid);
drop function if exists edit_comment(uuid, uuid, text);

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
      c.updated_at,
      a.nick,
      (uid is not null and c.account_id = uid) as mine,
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

create or replace function edit_comment(p_token uuid, p_comment uuid, p_body text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid;
begin
  select s.account_id into uid from sessions s where s.token = p_token;
  if uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if p_body is null or char_length(trim(p_body)) = 0 then
    return json_build_object('ok', false, 'error', 'empty_post');
  end if;
  if not exists (select 1 from comments where id = p_comment and account_id = uid) then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  update comments
  set body = p_body, updated_at = now()
  where id = p_comment
    and account_id = uid
    and body is distinct from p_body;

  return json_build_object('ok', true);
end;
$$;

grant execute on function list_comments(uuid, uuid) to anon, authenticated;
grant execute on function edit_comment(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
