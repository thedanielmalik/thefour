create or replace function public.claim_four_reward_card(p_card_code text,p_checked_members smallint[],p_claimed_by text)
returns table(claimed boolean,squad_id uuid,card_code text,checked_count integer)
language plpgsql security definer set search_path=public
as $$
declare
  card public.reward_cards;
  unique_count integer;
  missing_count integer;
begin
  select rc.* into card
  from public.reward_cards rc
  where rc.card_code=upper(trim(p_card_code))
  for update;
  if card.id is null then raise exception using errcode='P0001',message='Reward card not found.'; end if;
  if card.status<>'ready' then raise exception using errcode='P0001',message='Reward card is already claimed or expired.'; end if;
  select count(distinct n) into unique_count from unnest(coalesce(p_checked_members,'{}'::smallint[])) n where n between 1 and 4;
  if unique_count<>4 then raise exception using errcode='P0001',message='All four members must be checked in before the gift can be claimed.'; end if;
  select count(*) into missing_count from generate_series(1,4) n
  where not exists(select 1 from unnest(coalesce(p_checked_members,'{}'::smallint[])) x where x=n);
  if missing_count<>0 then raise exception using errcode='P0001',message='All four members must be checked in before the gift can be claimed.'; end if;
  insert into public.four_checkins(squad_id,member_id,member_number,checked_in_by)
  select card.squad_id,fm.id,fm.member_number,p_claimed_by
  from public.four_members fm
  where fm.squad_id=card.squad_id and fm.member_number between 1 and 4
  on conflict(member_id) do update set checked_in_at=now(),checked_in_by=excluded.checked_in_by;
  update public.reward_cards set status='claimed',claimed_at=now(),claimed_by=trim(coalesce(p_claimed_by,'Venue')) where id=card.id;
  update public.four_squads set status='attended' where id=card.squad_id;
  return query select true,card.squad_id,card.card_code,4;
end;
$$;
revoke all on function public.claim_four_reward_card(text,smallint[],text) from anon,authenticated;
grant execute on function public.claim_four_reward_card(text,smallint[],text) to service_role;
