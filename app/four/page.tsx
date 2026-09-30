'use client';

import { useEffect, useMemo, useState } from 'react';
import { fourApi } from '../../lib/four-api';

type Member = {
  member_number:number;
  name:string|null;
  photo_url?:string|null;
  shared?:boolean;
  share_channel?:string|null;
  share_confirmed_at?:string|null;
};
type Squad = { code:string; status:string; artwork_url?:string|null };
type RewardCard = {
  card_code:string;
  status:string;
  issued_at:string;
  claimed_at?:string|null;
  creator_name:string;
  members:Array<{member_number:number;name:string|null}>;
};

function homeHref(code:string) {
  const query = code ? '?four=' + encodeURIComponent(code) : '';
  return '../' + query;
}

export default function FourRoom(){
  const [code,setCode]=useState('');
  const [squad,setSquad]=useState<Squad|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [selectedMember,setSelectedMember]=useState<number>(1);
  const [phone,setPhone]=useState('');
  const [sharing,setSharing]=useState(false);
  const [shareNote,setShareNote]=useState('');
  const [rewardCard,setRewardCard]=useState<RewardCard|null>(null);
  const count=useMemo(()=>members.filter(m=>Boolean(m.name)).length,[members]);
  const shareCount=useMemo(()=>members.filter(m=>Boolean(m.shared)).length,[members]);

  async function loadRoom(value:string){
    try{
      const r=await fourApi('/fours?code='+encodeURIComponent(value));
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Four not found.');
      setSquad(data.squad||null);
      setMembers(Array.isArray(data.members)?data.members:[]);
      setError('');
      return data;
    }catch(e){
      setError(e instanceof Error?e.message:'Could not load Four room.');
      return null;
    }
  }

  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get('code')||'';
    setCode(value);
    if(!value){setError('Add a Four code to open the room.');setLoading(false);return;}
    let active=true;
    const load=async()=>{
      const data=await loadRoom(value);
      if(active && data) setLoading(false);
    };
    void load();
    const timer=window.setInterval(load,5000);
    return ()=>{active=false;window.clearInterval(timer)};
  },[]);

  async function shareAndConfirm(){
    if(!code || !selectedMember || !phone.trim()) { setShareNote('Select your place and enter the phone number used when you joined this Four.'); return; }
    const member=members.find(m=>m.member_number===selectedMember);
    if(!member){setShareNote('That Four place has not been claimed yet.');return;}
    setSharing(true);setShareNote('Opening your share…');
    try{
      const roomUrl=window.location.href;
      const artwork=squad?.artwork_url||roomUrl;
      const text='My Four is coming together. ❤️ Join us for THE FOUR — no one fights alone.';
      let completed=false;
      if(navigator.share){
        try{
          await navigator.share({title:'THE FOUR — My Four',text,url:roomUrl});
          completed=true;
        }catch{}
      }else{
        try{await navigator.clipboard?.writeText(text+' '+roomUrl);completed=true;}catch{}
      }
      if(!completed){setShareNote('Share was cancelled. Please share and try again.');return;}
      const res=await fourApi('/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,memberNumber:selectedMember,phone:phone.trim(),channel:navigator.share?'native_share':'other_self_confirmed'})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Your share could not be confirmed.');
      setShareNote(data.cardIssued && selectedMember===1 ? 'All four shares are confirmed. Your creator reward card is ready.' : 'Your share is confirmed. The Four Room is updated.');
      await loadRoom(code);
      if(selectedMember===1) await loadCreatorCard();
    }catch(e){setShareNote(e instanceof Error?e.message:'Your share could not be confirmed.');}
    finally{setSharing(false);}
  }

  async function loadCreatorCard(){
    if(!code || !phone.trim() || selectedMember!==1){return;}
    try{
      const r=await fourApi('/card?code='+encodeURIComponent(code)+'&phone='+encodeURIComponent(phone.trim()));
      const data=await r.json();
      setRewardCard(r.ok && data.card ? data.card : null);
    }catch{}
  }

  useEffect(()=>{
    if(selectedMember!==1 || !phone.trim() || !code)return;
    const timer=window.setInterval(()=>void loadCreatorCard(),5000);
    void loadCreatorCard();
    return()=>window.clearInterval(timer);
  },[selectedMember,phone,code]);

  return <main className="room-page">
    <header className="topbar shell"><a className="wordmark" href={homeHref(code)}>THE FOUR</a><div className="topbar-note">FIND YOUR FOUR • ROOM</div></header>
    <section className="room-hero shell">
      <div className="eyebrow">YOUR FOUR ROOM</div>
      {loading?<h1>Loading your Four…</h1>:error?<><h1>Four not found.</h1><p>{error}</p><a className="btn btn-primary" href="../">Back to FIND YOUR FOUR</a></>:<>
        <div className="room-code">FOUR CODE <strong>{squad?.code||code}</strong></div>
        <div className="room-live-summary"><div><strong>{shareCount}/4</strong><span>SHARES CONFIRMED</span></div><div><strong>{count}/4</strong><span>FOUR MEMBERS</span></div><div><strong>● LIVE</strong><span>UPDATES EVERY 5 SEC</span></div></div>
        <h1>{count===4 && shareCount===4 ? 'Your Four is ready.' : count===4 ? 'Your Four is complete — now get everyone to share.' : 'Bring your Four together.'}</h1>
        <p>Each member claims one place, shares the campaign, and the creator sees every confirmation here. The creator reward card unlocks only after all four shares are confirmed.</p>

        <div className="room-page-grid">{[1,2,3,4].map(n=>{const m=members.find(x=>x.member_number===n);return <article className={m?'room-page-slot filled':'room-page-slot'} key={n}><div className="room-slot-top"><span>0{n}</span><b className={m?.shared?'share-tag yes':'share-tag'}>{m?.shared?'✓ SHARED':'WAITING'}</b></div>{m?.photo_url?<img src={m.photo_url} alt="" />:<div className="room-avatar">{m?'✓':'OPEN'}</div>}<b>{m?.name||'OPEN'}</b>{m?.shared&&<small>{m.share_channel||'share'} • confirmed</small>}</article>})}</div>

        {squad?.artwork_url&&<div className="room-artwork"><div><div className="eyebrow">THE SHARED VISUAL</div><h2>Your Four became part of the campaign.</h2><p>Use this poster when you share. The room keeps the same Four code for everyone.</p></div><div><img src={squad.artwork_url} alt="Shared Four campaign artwork"/><a className="btn btn-ghost room-artwork-open" href={squad.artwork_url} target="_blank" rel="noreferrer">Open / Download Flyer ↗</a></div></div>}

        <div className="share-check-panel"><div className="eyebrow">CONFIRM YOUR SHARE</div><h2>One share per person. Four confirmations unlock the creator card.</h2><div className="share-check-row"><select value={selectedMember} onChange={e=>setSelectedMember(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>I am Member 0{n}</option>)}</select><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234 phone used for this Four"/><button className="btn btn-primary" disabled={sharing} onClick={shareAndConfirm}>{sharing?'Confirming…':'Share & Confirm'}</button></div><p className="inline-note">The system verifies the phone against the selected member place. This records a confirmed share action; social networks do not provide a universal public-post verification signal without their own platform integrations.</p>{shareNote&&<div className="inline-note strong-note">{shareNote}</div>}</div>

        {rewardCard&&<div className="creator-card"><div className="eyebrow">CREATOR REWARD CARD</div><div className="creator-card-inner"><div><strong>FOUR READY.</strong><span>This card belongs to {rewardCard.creator_name}.</span><small>Bring this card and all three friends to the cinema/premiere claim point. Venue staff verifies all four members before releasing the gift.</small></div><div className="creator-card-code">{rewardCard.card_code}</div></div><div className="creator-card-members">{rewardCard.members.map(m=><span key={m.member_number}>0{m.member_number} {m.name||'Member'}</span>)}</div></div>}

        <div className="room-page-actions"><a className="btn btn-primary" href={homeHref(code)}>Back to Campaign</a><button className="btn btn-ghost" onClick={async()=>{try{await navigator.clipboard?.writeText(window.location.href);setShareNote('Room link copied.')}catch{}}}>Copy Room Link</button></div>
      </>}
    </section>
  </main>
}