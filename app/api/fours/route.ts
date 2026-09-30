import { NextResponse } from 'next/server';

type Payload = {
  code:string;name:string;phone:string;email?:string;consent:boolean;
  memberNumber?:number;preferredCinema?:string;preferredDate?:string;preferredShowtime?:string;
};

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url:url.replace(/\/$/,''),key}:null}

export async function GET(request:Request){
  const code=new URL(request.url).searchParams.get('code');
  if(!code)return NextResponse.json({error:'Four code is required.'},{status:400});
  const c=config();
  if(!c)return NextResponse.json({demo:true,code,status:'prototype',members:[]});
  const headers={apikey:c.key,Authorization:'Bearer '+c.key};
  const base=c.url+'/rest/v1';
  const squadRes=await fetch(base+'/four_squads?code=eq.'+encodeURIComponent(code)+'&select=id,code,status,preferred_cinema,preferred_date,preferred_showtime,created_at',{headers});
  if(!squadRes.ok)return NextResponse.json({error:'Could not load Four.'},{status:502});
  const squads=await squadRes.json();
  if(!squads[0])return NextResponse.json({error:'Four not found.'},{status:404});
  const membersRes=await fetch(base+'/four_members?squad_id=eq.'+encodeURIComponent(squads[0].id)+'&select=member_number,name,phone,email,joined_at&order=member_number.asc',{headers});
  const members=membersRes.ok?await membersRes.json():[];
  return NextResponse.json({squad:squads[0],members});
}

export async function POST(request:Request){
  const body=(await request.json()) as Payload;
  if(!body.code||!body.name||!body.phone||!body.consent)return NextResponse.json({error:'Name, phone, Four code and consent are required.'},{status:400});
  const c=config(); if(!c)return NextResponse.json({demo:true,code:body.code,memberNumber:body.memberNumber||1});

  const headers={apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',Prefer:'return=representation'};
  const base=c.url+'/rest/v1';

  const lookup=await fetch(base+'/four_squads?code=eq.'+encodeURIComponent(body.code)+'&select=id',{headers});
  if(!lookup.ok)return NextResponse.json({error:'Could not check Four code.'},{status:502});
  const found=await lookup.json() as Array<{id:string}>;

  const fields={
    creator_name:body.name,creator_phone:body.phone,creator_email:body.email||null,consent:true,status:'registered',
    preferred_cinema:body.preferredCinema||null,preferred_date:body.preferredDate||null,preferred_showtime:body.preferredShowtime||null
  };

  let squadId=found[0]?.id;
  let memberNumber=body.memberNumber||1;

  if(!squadId){
    const create=await fetch(base+'/four_squads',{method:'POST',headers,body:JSON.stringify({code:body.code,...fields})});
    if(!create.ok)return NextResponse.json({error:'Could not create the Four.'},{status:502});
    const created=await create.json() as Array<{id:string}>;
    squadId=created[0]?.id;
    memberNumber=1;
  }else{
    const current=await fetch(base+'/four_members?squad_id=eq.'+encodeURIComponent(squadId)+'&select=member_number&order=member_number.asc',{headers});
    const occupied=current.ok?(await current.json() as Array<{member_number:number}>).map(x=>x.member_number):[];
    if(!body.memberNumber){
      const next=[1,2,3,4].find(n=>!occupied.includes(n));
      if(next)memberNumber=next;
    }
    const update=await fetch(base+'/four_squads?id=eq.'+encodeURIComponent(squadId),{method:'PATCH',headers,body:JSON.stringify(fields)});
    if(!update.ok)return NextResponse.json({error:'Could not update Four registration.'},{status:502});
  }

  const member=await fetch(base+'/four_members?on_conflict=squad_id,member_number',{
    method:'POST',
    headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},
    body:JSON.stringify({squad_id:squadId,member_number:memberNumber,name:body.name,phone:body.phone,email:body.email||null,joined_at:new Date().toISOString()})
  });
  if(!member.ok)return NextResponse.json({error:'Could not add Four member.'},{status:502});

  const eventType=body.preferredCinema?'cinema_selected':memberNumber===1?'registered':'member_joined';
  await fetch(base+'/campaign_events',{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({
    squad_id:squadId,event_type:eventType,channel:'web',metadata:{consent:true,memberNumber,cinema:body.preferredCinema||null,showtime:body.preferredShowtime||null}
  })});

  return NextResponse.json({ok:true,code:body.code,squadId,memberNumber});
}
