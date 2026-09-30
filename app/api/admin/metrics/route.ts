import { NextResponse } from 'next/server';

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,admin=process.env.ADMIN_DASHBOARD_TOKEN;return url&&key&&admin?{url:url.replace(/\/$/,''),key,admin}:null}

export async function GET(request:Request){
  const auth=request.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  const c=config();
  if(!c)return NextResponse.json({error:'Admin dashboard is not configured.'},{status:503});
  if(token!==c.admin)return NextResponse.json({error:'Unauthorized.'},{status:401});
  const headers={apikey:c.key,Authorization:'Bearer '+c.key};
  const res=await fetch(c.url+'/rest/v1/four_campaign_metrics?select=*',{headers});
  if(!res.ok)return NextResponse.json({error:'Could not load campaign metrics.'},{status:502});
  const rows=await res.json();
  return NextResponse.json(rows[0]||{});
}
