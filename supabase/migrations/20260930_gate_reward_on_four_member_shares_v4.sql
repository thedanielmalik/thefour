create or replace function public.qualify_four_reward(p_squad_id uuid)
returns table(qualified boolean,reward_code text,rank integer)
language plpgsql security definer set search_path=public
as $$
declare member_count integer; share_count integer; existing_code text; existing_created_at timestamptz; new_code text; current_count integer;
begin
  perform pg_advisory_xact_lock(41004);
  select count(*) into member_count from public.four_members where squad_id=p_squad_id;
  select count(*) into share_count from public.four_member_shares where squad_id=p_squad_id;
  if member_count<4 or share_count<4 then return query select false,null::text,null::integer; return; end if;
  select rc.reward_code,rc.created_at into existing_code,existing_created_at from public.reward_claims rc where rc.squad_id=p_squad_id limit 1;
  if existing_code is not null then
    select count(*) into current_count from public.reward_claims rc where rc.created_at<=existing_created_at;
    return query select true,existing_code,current_count;
    return;
  end if;
  select count(*) into current_count from public.reward_claims;
  if current_count>=500 then return query select false,null::text,null::integer; return; end if;
  loop
    new_code:='F4R-'||upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,10));
    begin insert into public.reward_claims(squad_id,reward_code,qualified_at,status) values(p_squad_id,new_code,now(),'qualified'); exit;
    exception when unique_violation then end;
  end loop;
  return query select true,new_code,current_count+1;
end;
$$;
revoke all on function public.qualify_four_reward(uuid) from anon,authenticated;
grant execute on function public.qualify_four_reward(uuid) to service_role;
