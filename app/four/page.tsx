'use client';

import { useEffect, useMemo, useState } from 'react';
import { fourApi } from '../../lib/four-api';

type Member = { member_number:number; name:string|null; photo_url?:string|null };
type Squad = { code:string; status:string; artwork_url?:string|null };

function homeUrl(code:string) {
  const url = new URL(window.location.href);
  const base = url.pathname.split('/four')[0] || '/';
  url.pathname = base.replace(/\/$/, '/') || '/';
  url.search = '?four=' + encodeURIComponent(code);
  return url.toString();
}

export default function FourRoom(){
  const [code,setCode]=useState('');
  const [squad,setSquad]=useState<Squad|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const count=useMemo(()=>members.filter(m=>Boolean(m.name)).length,[members]);

  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get('code')||'';
    setCode(value);
    if(!value){setError('Add a Four code to open the room.');setLoading(false);return;}
    let active=true;
    fourApi('/fours?code='+encodeURIComponent(value)).then(async r=>{
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Four not found.');
      if(!active)return;
      setSquad(data.squad||null);
      setMembers(Array.isArray(data.members)?data.members:[]);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load Four room.')})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[]);

  return <main className="room-page">
    <header className="topbar shell"><a className="wordmark" href={homeUrl(code)}>THE FOUR</a><div className="topbar-note">FIND YOUR FOUR • ROOM</div></header>
    <section className="room-hero shell">
      <div className="eyebrow">YOUR FOUR ROOM</div>
      {loading?<h1>Loading your Four…</h1>:error?<><h1>Four not found.</h1><p>{error}</p><a className="btn btn-primary" href={homeUrl('')}>Back to FIND YOUR FOUR</a></>:<>
        <div className="room-code">FOUR CODE <strong>{squad?.code||code}</strong></div>
        <h1>{count === 4 ? 'Your Four is complete.' : 'Bring your Four together.'}</h1>
        <p>Share this room link with your people. Each person claims one place and adds their photo.</p>
        <div className="room-page-grid">{[1,2,3,4].map(n=>{const m=members.find(x=>x.member_number===n);return <article className={m?'room-page-slot filled':'room-page-slot'} key={n}><span>0{n}</span>{m?.photo_url?<img src={m.photo_url} alt="" />:<div className="room-avatar">{m?'✓':'OPEN'}</div>}<b>{m?.name||'OPEN'}</b></article>})}</div>
        {squad?.artwork_url&&<div className="room-artwork"><div><div className="eyebrow">THE SHARED VISUAL</div><h2>Your Four became part of the campaign.</h2></div><img src={squad.artwork_url} alt="Shared Four campaign artwork"/></div>}
        <div className="room-page-actions"><a className="btn btn-primary" href={homeUrl(code)}>Claim / Update My Place</a><button className="btn btn-ghost" onClick={async()=>{try{await navigator.clipboard?.writeText(window.location.href)}catch{} }}>Copy Room Link</button></div>
      </>}
    </section>
  </main>
}
