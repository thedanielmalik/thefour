import { NextResponse } from 'next/server';

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;return url&&key?{url:url.replace(/\/$/,''),key}:null}

export async function POST(request:Request){
  const body=await request.json() as {code?:string};
  if(!body.code)return NextResponse.json({error:'Four code is required.'},{status:400});
  const c=config();
  if(!c)return NextResponse.json({demo:true,qualified:false});
  const headers={apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'};
  const base=c.url+'/rest/v1';
  const lookup=await fetch(base+'/four_squads?code=eq.'+encodeURIComponent(body.code)+'&select=id,status',{headers});
  if(!lookup.ok)return NextResponse.json({error:'Could not find this Four.'},{status:502});
  const squads=await lookup.json() as Array<{id:string,status:string}>;
  if(!squads[0])return NextResponse.json({error:'Four not found.'},{status:404});
  const rpc=await fetch(c.url+'/rest/v1/rpc/qualify_four_reward',{
    method:'POST',headers,body:JSON.stringify({p_squad_id:squads[0].id})
  });
  if(!rpc.ok)return NextResponse.json({error:'Could not qualify reward.'},{status:502});
  const rows=await rpc.json() as Array<{qualified:boolean;reward_code:string|null;rank:number|null}>;
  const result=rows[0]||{qualified:false,reward_code:null,rank:null};
  return NextResponse.json({...result,code:body.code});
}
