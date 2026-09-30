import { NextResponse } from 'next/server';

type RegisterPayload = {
  code:string;name:string;phone:string;email?:string;consent:boolean;
  preferredCinema?:string;preferredDate?:string;preferredShowtime?:string;
};

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url:url.replace(/\/$/,''),key}:null}

export async function POST(request:Request){
  const body=(await request.json()) as RegisterPayload;
  if(!body.code||!body.name||!body.phone||!body.consent)return NextResponse.json({error:'Name, phone, Four code and consent are required.'},{status:400});
  const c=config(); if(!c)return NextResponse.json({demo:true,code:body.code});
  const headers={apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',Prefer:'return=representation'};
  const base=c.url+'/rest/v1';
  const lookup=await fetch(base+'/four_squads?code=eq.'+encodeURIComponent(body.code)+'&select=id',{headers});
  if(!lookup.ok)return NextResponse.json({error:'Could not check Four code.'},{status:502});
  const found=await lookup.json() as Array<{id:string}>;
  const fields={creator_name:body.name,creator_phone:body.phone,creator_email:body.email||null,consent:true,status:'registered',preferred_cinema:body.preferredCinema||null,preferred_date:body.preferredDate||null,preferred_showtime:body.preferredShowtime||null};
  let squadId=found[0]?.id;
  if(squadId){const update=await fetch(base+'/four_squads?id=eq.'+encodeURIComponent(squadId),{method:'PATCH',headers,body:JSON.stringify(fields)});if(!update.ok)return NextResponse.json({error:'Could not update Four registration.'},{status:502});}
  else{const create=await fetch(base+'/four_squads',{method:'POST',headers,body:JSON.stringify({code:body.code,...fields})});if(!create.ok)return NextResponse.json({error:'Could not save Four registration.'},{status:502});const created=await create.json() as Array<{id:string}>;squadId=created[0]?.id;}
  await fetch(base+'/campaign_events',{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({squad_id:squadId,event_type:body.preferredCinema?'cinema_selected':'registered',channel:'web',metadata:{consent:true,cinema:body.preferredCinema||null,showtime:body.preferredShowtime||null}})});
  return NextResponse.json({ok:true,code:body.code,squadId});
}
