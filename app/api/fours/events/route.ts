import { NextResponse } from 'next/server';

type EventPayload = {
  code?: string;
  eventType: 'created'|'photo_uploaded'|'artwork_generated'|'shared'|'invited'|'member_joined'|'registered'|'cinema_selected'|'ticket_clicked'|'reward_qualified'|'reward_claimed'|'attended';
  channel?: string;
  metadata?: Record<string, unknown>;
};

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url:url.replace(/\/$/,''),key}:null}

export async function POST(request:Request){
  const body=(await request.json()) as EventPayload;
  if(!body.eventType)return NextResponse.json({error:'eventType is required.'},{status:400});
  const c=config();
  if(!c)return NextResponse.json({demo:true});
  const headers={apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',Prefer:'return=minimal'};
  const base=c.url+'/rest/v1';
  let squadId:string|null=null;
  if(body.code){
    const lookup=await fetch(base+'/four_squads?code=eq.'+encodeURIComponent(body.code)+'&select=id',{headers});
    if(lookup.ok){const rows=await lookup.json() as Array<{id:string}>;squadId=rows[0]?.id||null;}
  }
  const res=await fetch(base+'/campaign_events',{method:'POST',headers,body:JSON.stringify({
    squad_id:squadId,event_type:body.eventType,channel:body.channel||'web',metadata:body.metadata||{}
  })});
  if(!res.ok)return NextResponse.json({error:'Could not log campaign event.'},{status:502});
  return NextResponse.json({ok:true});
}
