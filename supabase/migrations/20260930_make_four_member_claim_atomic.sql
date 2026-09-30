create or replace function public.claim_four_member(
  p_squad_id uuid,
  p_member_number smallint,
  p_name text,
  p_phone text,
  p_email text,
  p_consent boolean
)
returns table(member_id uuid, member_number smallint, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_number smallint := p_member_number;
  existing_id uuid;
  existing_phone text;
  next_number smallint;
begin
  if not p_consent then
    raise exception using errcode='P0001', message='Consent is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_squad_id::text, 44004));

  if target_number is null or target_number not between 1 and 4 then
    select fm.id, fm.member_number
      into existing_id, target_number
    from public.four_members fm
    where fm.squad_id = p_squad_id
      and trim(coalesce(fm.phone,'')) = trim(p_phone)
    order by fm.member_number
    limit 1;

    if existing_id is not null then
      update public.four_members
      set name=trim(p_name), email=nullif(trim(coalesce(p_email,'')),''), consent=true, joined_at=coalesce(joined_at, now())
      where id=existing_id;

      return query select existing_id, target_number, false;
      return;
    end if;

    for next_number in 1..4 loop
      if not exists (
        select 1 from public.four_members fm
        where fm.squad_id=p_squad_id and fm.member_number=next_number
      ) then
        target_number := next_number;
        exit;
      end if;
    end loop;

    if target_number is null or target_number not between 1 and 4 then
      raise exception using errcode='P0001', message='This Four is already complete.';
    end if;
  end if;

  select fm.id, fm.phone
    into existing_id, existing_phone
  from public.four_members fm
  where fm.squad_id=p_squad_id and fm.member_number=target_number
  limit 1;

  if existing_id is not null then
    if trim(coalesce(existing_phone,'')) <> trim(p_phone) then
      raise exception using errcode='P0001', message='That Four place is already claimed.';
    end if;

    update public.four_members
    set name=trim(p_name), email=nullif(trim(coalesce(p_email,'')),''), consent=true, joined_at=coalesce(joined_at, now())
    where id=existing_id;

    return query select existing_id, target_number, false;
    return;
  end if;

  insert into public.four_members(squad_id,member_number,name,phone,email,consent,joined_at)
  values(p_squad_id,target_number,trim(p_name),trim(p_phone),nullif(trim(coalesce(p_email,'')),''),true,now())
  returning id into existing_id;

  return query select existing_id, target_number, true;
end;
$$;

revoke all on function public.claim_four_member(uuid,smallint,text,text,text,boolean) from anon, authenticated;
grant execute on function public.claim_four_member(uuid,smallint,text,text,text,boolean) to service_role;