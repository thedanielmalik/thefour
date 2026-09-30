'use client';

import { useState } from 'react';
import { fourApi } from '../../lib/four-api';

type AdminMember = {
  member_number:number; name:string|null; phone:string|null; email:string|null; joined_at:string|null;
  public_activity_opt_in:boolean; shared:boolean; share_channel:string|null; share_confirmed_at:string|null; checked_in:boolean;
};
type AdminFour = {
  squad:{id:string;code:string;status:string;created_at:string;preferred_cinema?:string|null;preferred_date?:string|null;preferred_showtime?:string|null};
  members:AdminMember[];
  reward_card:{card_code:string;status:string;issued_at:string;claimed_at:string|null;claimed_by:string|null}|null;
};

const labels=[
  ['four_squads_created','Four Squads Created'],
  ['people_registered','People Registered'],
  ['social_shares','Legacy Share Events'],
  ['member_shares_confirmed','Member Shares Confirmed'],
  ['complete_fours','Complete Fours'],
  ['cinema_intent','Cinema Intent'],
  ['ticket_clicks','Ticket Clicks'],
  ['reward_cards_ready','Reward Cards Ready'],
  ['reward_cards_claimed','Reward Cards Claimed']
] as const;

export default function AdminPage(){
  const [token,setToken]=useState('');
  const [metrics,setMetrics]=useState<Record<string,number>|null>(null);
  const [fourCode,setFourCode]=useState('');
  const [four,setFour]=useState<AdminFour|null>(null);
  const [claimChecks,setClaimChecks]=useState<number[]>([]);
  const [claimName,setClaimName]=useState('Venue');
  const [loading,setLoading]=useState(false);
  const [fourLoading,setFourLoading]=useState(false);
  const [claiming,setClaiming]=useState(false);
  const [error,setError]=useState('');

  async function load(){
    if(!token.trim()){setError('Enter the dashboard token.');return;}
    setLoading(true);setError('');
    try{
      const res=await fourApi('/metrics',{headers:{'x-admin-token':token.trim()}});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not load dashboard.');
      setMetrics(data);
    }catch(e){setError(e instanceof Error?e.message:'Could not load dashboard.');}
    finally{setLoading(false);}
  }

  async function lookupFour(){
    if(!token.trim()||!fourCode.trim()){setError('Enter the dashboard token and Four code.');return;}
    setFourLoading(true);setError('');setFour(null);setClaimChecks([]);
    try{
      const res=await fourApi('/admin/four?code='+encodeURIComponent(fourCode.trim()),{headers:{'x-admin-token':token.trim()}});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not load Four.');
      setFour(data);
    }catch(e){setError(e instanceof Error?e.message:'Could not load Four.');}
    finally{setFourLoading(false);}
  }

  async function claimReward(){
    if(!token.trim()||!four?.reward_card?.card_code)return;
    if(claimChecks.length!==4){setError('Check in all four members before claiming the gift.');return;}
    setClaiming(true);setError('');
    try{
      const res=await fourApi('/claim-card',{method:'POST',headers:{'Content-Type':'application/json','x-admin-token':token.trim()},body:JSON.stringify({cardCode:four.reward_card.card_code,checkedMembers:claimChecks,claimedBy:claimName||'Venue'})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not claim reward card.');
      await lookupFour();
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not claim reward card.');}
    finally{setClaiming(false);}
  }

  function toggleCheck(n:number){setClaimChecks(prev=>prev.includes(n)?prev.filter(x=>x!==n):[...prev,n]);}

  return <main className='admin-shell'>
    <div className='eyebrow'>THE FOUR • CAMPAIGN CONTROL</div>
    <h1>Campaign dashboard.</h1>
    <p>Live campaign signals, per-member share confirmation and creator reward-card control.</p>
    <div className='admin-login'><input type='password' placeholder='Dashboard token' value={token} onChange={e=>setToken(e.target.value)}/><button onClick={load}>{loading?'Loading…':'Open Dashboard'}</button></div>
    {error&&<div className='admin-error'>{error}</div>}
    {metrics&&<div className='admin-grid'>{labels.map(([key,label])=><div className='admin-card' key={key}><strong>{metrics[key]??0}</strong><span>{label}</span></div>)}</div>}

    <section className='admin-four-search'>
      <div className='eyebrow'>FOUR VERIFICATION</div>
      <h2>Inspect a Four.</h2>
      <p>Enter a Four code to see all four member names, share confirmation, public-feed opt-in, venue check-in state and the creator card.</p>
      <div className='admin-four-row'><input value={fourCode} onChange={e=>setFourCode(e.target.value.toUpperCase())} placeholder='F4-XXXXXX'/><button onClick={lookupFour} disabled={fourLoading}>{fourLoading?'Loading…':'Open Four'}</button></div>

      {four&&<div className='admin-four-panel'>
        <div className='admin-four-meta'><div><span>FOUR</span><strong>{four.squad.code}</strong></div><div><span>STATUS</span><strong>{four.squad.status}</strong></div><div><span>CINEMA</span><strong>{four.squad.preferred_cinema||'Not selected'}</strong></div></div>
        <div className='admin-member-table'>{four.members.map(m=><div className='admin-member-row' key={m.member_number}><div className='admin-member-no'>0{m.member_number}</div><div className='admin-member-main'><strong>{m.name||'Open place'}</strong><span>{m.phone||'—'}{m.email?' • '+m.email:''}</span></div><div className={m.shared?'admin-badge yes':'admin-badge'}>{m.shared?'✓ SHARED':'WAITING'}</div><div className={m.checked_in?'admin-badge yes':'admin-badge'}>{m.checked_in?'✓ CHECKED IN':'NOT IN'}</div></div>)}</div>

        <div className='admin-card-box'><div className='eyebrow'>CREATOR CARD</div>{four.reward_card?<><strong>{four.reward_card.card_code}</strong><span>{four.reward_card.status.toUpperCase()}</span><small>Issued {new Date(four.reward_card.issued_at).toLocaleString()}</small></>:<p>The creator card unlocks automatically when all four member shares are confirmed.</p>}</div>

        {four.reward_card&&four.reward_card.status==='ready'&&<div className='admin-claim-box'><div className='eyebrow'>VENUE CLAIM</div><h3>Check in all four, then release the gift.</h3><div className='admin-check-grid'>{four.members.map(m=><label key={m.member_number}><input type='checkbox' checked={claimChecks.includes(m.member_number)} onChange={()=>toggleCheck(m.member_number)}/><span>0{m.member_number} {m.name||'Open'}</span></label>)}</div><div className='admin-four-row'><input value={claimName} onChange={e=>setClaimName(e.target.value)} placeholder='Staff / venue name'/><button onClick={claimReward} disabled={claiming||claimChecks.length!==4}>{claiming?'Claiming…':'Release Creator Gift'}</button></div><p className='inline-note'>This marks the creator reward card as claimed and records all four as present in the venue check-in log.</p></div>}
      </div>}
    </section>
  </main>
}