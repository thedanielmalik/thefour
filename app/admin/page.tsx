'use client';

import { useState } from 'react';

const labels=[
  ['four_squads_created','Four Squads Created'],
  ['people_registered','People Registered'],
  ['social_shares','Social Shares'],
  ['cinema_intent','Cinema Intent'],
  ['ticket_clicks','Ticket Clicks'],
  ['complete_fours','Complete Fours'],
  ['rewards_qualified','Rewards Qualified']
] as const;

export default function AdminPage(){
  const [token,setToken]=useState('');
  const [metrics,setMetrics]=useState<Record<string,number>|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  async function load(){
    if(!token.trim()){setError('Enter the dashboard token.');return;}
    setLoading(true);setError('');
    try{
      const res=await fetch('/api/admin/metrics',{headers:{Authorization:'Bearer '+token.trim()}});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not load dashboard.');
      setMetrics(data);
    }catch(e){setError(e instanceof Error?e.message:'Could not load dashboard.');}
    finally{setLoading(false);}
  }

  return <main className="admin-shell">
    <div className="eyebrow">THE FOUR • CAMPAIGN CONTROL</div>
    <h1>Campaign dashboard.</h1>
    <p>Live campaign signals from the FIND YOUR FOUR experience.</p>
    <div className="admin-login"><input type="password" placeholder="Dashboard token" value={token} onChange={e=>setToken(e.target.value)}/><button onClick={load}>{loading?'Loading…':'Open Dashboard'}</button></div>
    {error&&<div className="admin-error">{error}</div>}
    {metrics&&<div className="admin-grid">{labels.map(([key,label])=><div className="admin-card" key={key}><strong>{metrics[key]??0}</strong><span>{label}</span></div>)}</div>}
  </main>
}
