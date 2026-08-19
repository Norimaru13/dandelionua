create table if not exists page_stats (
  page_id text primary key,
  views int not null default 0,
  likes int not null default 0
);

create table if not exists page_visitors (
  page_id text not null,
  visitor_id text not null,
  viewed boolean not null default false,
  liked boolean not null default false,
  primary key (page_id, visitor_id)
);

alter table page_stats enable row level security;
alter table page_visitors enable row level security;

drop policy if exists stats_select on page_stats;
create policy stats_select on page_stats
  for select to anon, authenticated
  using (true);

create or replace function record_view(p_page text, p_visitor text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  already boolean;
  v_views int;
  v_likes int;
  v_liked boolean;
begin
  insert into page_stats (page_id) values (p_page)
  on conflict (page_id) do nothing;

  select viewed into already
  from page_visitors
  where page_id = p_page and visitor_id = p_visitor;

  if already is null then
    insert into page_visitors (page_id, visitor_id, viewed, liked)
    values (p_page, p_visitor, true, false);
    update page_stats set views = views + 1 where page_id = p_page;
  elsif already = false then
    update page_visitors set viewed = true
    where page_id = p_page and visitor_id = p_visitor;
    update page_stats set views = views + 1 where page_id = p_page;
  end if;

  select views, likes into v_views, v_likes from page_stats where page_id = p_page;
  select coalesce(liked, false) into v_liked
  from page_visitors
  where page_id = p_page and visitor_id = p_visitor;

  return json_build_object('views', v_views, 'likes', v_likes, 'liked', v_liked);
end;
$$;

create or replace function toggle_like(p_page text, p_visitor text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  was_liked boolean;
  v_views int;
  v_likes int;
  v_liked boolean;
begin
  insert into page_stats (page_id) values (p_page)
  on conflict (page_id) do nothing;

  insert into page_visitors (page_id, visitor_id, viewed, liked)
  values (p_page, p_visitor, false, false)
  on conflict (page_id, visitor_id) do nothing;

  select liked into was_liked
  from page_visitors
  where page_id = p_page and visitor_id = p_visitor;

  if was_liked then
    update page_visitors set liked = false
    where page_id = p_page and visitor_id = p_visitor;
    update page_stats set likes = greatest(likes - 1, 0) where page_id = p_page;
    v_liked := false;
  else
    update page_visitors set liked = true
    where page_id = p_page and visitor_id = p_visitor;
    update page_stats set likes = likes + 1 where page_id = p_page;
    v_liked := true;
  end if;

  select views, likes into v_views, v_likes from page_stats where page_id = p_page;
  return json_build_object('views', v_views, 'likes', v_likes, 'liked', v_liked);
end;
$$;

grant execute on function record_view(text, text) to anon, authenticated;
grant execute on function toggle_like(text, text) to anon, authenticated;
