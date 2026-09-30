create or replace function public.qualify_four_reward(p_squad_id uuid)
returns table (qualified boolean, reward_code text, rank integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count integer;
  existing_code text;
  new_code text;
  current_count integer;
begin
  perform pg_advisory_xact_lock(41004);

  select count(*) into member_count
  from public.four_members
  where squad_id = p_squad_id;

  if member_count < 4 then
    update public.four_squads set status = 'registered' where id = p_squad_id;
    return query select false, null::text, null::integer;
    return;
  end if;

  select rc.reward_code into existing_code
  from public.reward_claims rc
  where rc.squad_id = p_squad_id
  limit 1;

  if existing_code is not null then
    update public.four_squads set status = 'complete' where id = p_squad_id;
    select count(*) into current_count from public.reward_claims rc
      where rc.created_at <= (select r2.created_at from public.reward_claims r2 where r2.squad_id=p_squad_id limit 1);
    return query select true, existing_code, current_count;
    return;
  end if;

  select count(*) into current_count from public.reward_claims;
  if current_count >= 500 then
    update public.four_squads set status = 'complete' where id = p_squad_id;
    return query select false, null::text, null::integer;
    return;
  end if;

  loop
    new_code := 'F4R-' || upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,10));
    begin
      insert into public.reward_claims(squad_id,reward_code,qualified_at,status)
      values(p_squad_id,new_code,now(),'qualified');
      exit;
    exception when unique_violation then
      -- Extremely unlikely code collision; retry.
    end;
  end loop;

  update public.four_squads set status = 'complete' where id = p_squad_id;

  return query select true, new_code, current_count + 1;
end;
$$;

revoke all on function public.qualify_four_reward(uuid) from anon, authenticated;
grant execute on function public.qualify_four_reward(uuid) to service_role;

create or replace view public.four_campaign_metrics
with (security_invoker = true)
as
select
  (select count(*) from public.four_squads) as four_squads_created,
  (select count(*) from public.four_members) as people_registered,
  (select count(*) from public.campaign_events where event_type = 'shared') as social_shares,
  (select count(*) from public.campaign_events where event_type = 'cinema_selected') as cinema_intent,
  (select count(*) from public.reward_claims where status in ('qualified','claimed')) as rewards_qualified,
  (select count(*) from public.four_squads where status = 'complete') as complete_fours,
  (select count(*) from public.campaign_events where event_type = 'ticket_clicked') as ticket_clicks;
