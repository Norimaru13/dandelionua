drop function if exists account_rename(uuid, text);

create or replace function account_rename(p_token uuid, p_nick text)
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
  if not nick_ok(p_nick) then
    return json_build_object('ok', false, 'error', 'bad_nick');
  end if;
  if exists (
    select 1 from accounts
    where lower(nick) = lower(p_nick) and id <> uid
  ) then
    return json_build_object('ok', false, 'error', 'taken');
  end if;

  update accounts set nick = p_nick where id = uid;
  return json_build_object('ok', true, 'nick', p_nick);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'taken');
end;
$$;

grant execute on function account_rename(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
