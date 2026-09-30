'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Member = { file: File | null; name: string; preview: string | null };
type Cinema = { name: string; area: string; showtimes: string[] };

// DEMO inventory only. Replace with approved partner/cinema feed before launch.\nconst CINEMAS: Cinema[] = [
  { name: 'Genesis Deluxe Cinemas — Maryland (DEMO)', area: 'Lagos', showtimes: ['12:30 PM','3:15 PM','6:00 PM','8:45 PM'] },
  { name: 'Filmhouse Cinemas — Lekki (DEMO)', area: 'Lagos', showtimes: ['1:00 PM','3:45 PM','6:30 PM','9:15 PM'] },
  { name: 'Filmhouse Cinemas — Surulere (DEMO)', area: 'Lagos', showtimes: ['12:15 PM','3:00 PM','5:45 PM','8:30 PM'] },
  { name: 'Genesis Deluxe Cinemas — Ikeja (DEMO)', area: 'Lagos', showtimes: ['12:45 PM','3:30 PM','6:15 PM','9:00 PM'] }
];

const freshMembers = (): Member[] => [1,2,3,4].map(() => ({ file:null, name:'', preview:null }));

async function trackEvent(code: string | undefined, eventType: 'created'|'photo_uploaded'|'artwork_generated'|'shared'|'invited'|'member_joined'|'registered'|'cinema_selected'|'ticket_clicked'|'reward_qualified'|'reward_claimed'|'attended', channel?: string, metadata?: Record<string, unknown>) {\n  try { await fetch('/api/fours/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,eventType,channel,metadata})}); } catch {}\n}\n\nfunction makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'F4-';
  for (let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w/img.width,h/img.height);
  const sw = w/scale, sh = h/scale;
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
}

export default function Home() {
  const [members,setMembers]=useState<Member[]>(freshMembers);
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState<1|2|3|4>(1);
  const [code,setCode]=useState('');
  const [artwork,setArtwork]=useState<string|null>(null);
  const [artworkBlob,setArtworkBlob]=useState<Blob|null>(null);
  const [busy,setBusy]=useState(false);
  const [registered,setRegistered]=useState(false);\n  const [isInvite,setIsInvite]=useState(false);\n  const [memberNumber,setMemberNumber]=useState<number|null>(null);
  const [chosenCinema,setChosenCinema]=useState('');
  const [chosenShowtime,setChosenShowtime]=useState('');
  const [chosenDate,setChosenDate]=useState('');
  const [regName,setRegName]=useState('');
  const [regPhone,setRegPhone]=useState('');
  const [regEmail,setRegEmail]=useState('');
  const [consent,setConsent]=useState(false);
  const [apiNote,setApiNote]=useState('');\n  const [reward,setReward]=useState<{qualified:boolean;reward_code:string|null;rank:number|null}|null>(null);
  const fileInputs=useRef<Array<HTMLInputElement|null>>([]);

  const posterUrl = process.env.NEXT_PUBLIC_THE_FOUR_POSTER_URL || '';
  const complete = useMemo(()=>members.every(m=>Boolean(m.file)),[members]);
  const cinema = CINEMAS.find(c=>c.name===chosenCinema);

  useEffect(()=>{
    const invited=new URLSearchParams(window.location.search).get('four');
    if(invited){setCode(invited);setIsInvite(true);setOpen(true);setStep(4);setApiNote('You have been invited into an existing Four. Complete your details below.');}
  },[]);

  function reset() {
    members.forEach(m=>m.preview&&URL.revokeObjectURL(m.preview));
    setMembers(freshMembers());setArtwork(null);setArtworkBlob(null);setCode('');setRegistered(false);
    setChosenCinema('');setChosenShowtime('');setChosenDate('');setRegName('');setRegPhone('');setRegEmail('');
    setConsent(false);setApiNote('');setMemberNumber(null);setIsInvite(false);setStep(1);
  }

  function pick(index:number,file:File|null){
    if(!file||!file.type.startsWith('image/'))return;
    if(file.size>8*1024*1024){alert('Please use an image smaller than 8MB.');return;}
    const preview=URL.createObjectURL(file);
    setMembers(prev=>prev.map((m,i)=>{
      if(i!==index)return m;
      if(m.preview)URL.revokeObjectURL(m.preview);
      return {...m,file,preview};
    }));
  }

  function setName(i:number,name:string){setMembers(prev=>prev.map((m,idx)=>idx===i?{...m,name}:m));}

  async function trackEvent(codeValue:string|undefined,eventType:string,channel='web',metadata?:Record<string,unknown>){try{await fetch('/api/fours/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:codeValue,eventType,channel,metadata})})}catch{}}\n\n  async function generateArtwork(){
    if(!complete){alert('Add all four photos before creating your Four.');return;}
    setBusy(true);
    try{
      const imgs=await Promise.all(members.map(m=>new Promise<HTMLImageElement>((resolve,reject)=>{
        const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=m.preview!;
      })));
      const fourCode=code||makeCode();setCode(fourCode);
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      ctx.fillStyle='#f4efe5';ctx.fillRect(0,0,1080,1350);
      ctx.fillStyle='#173b4d';ctx.font='500 52px Georgia,serif';ctx.textAlign='center';ctx.fillText('THE FOUR',540,76);
      ctx.fillStyle='#6f1d2b';ctx.font='700 19px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,108);
      const margin=46,gap=16,tileW=(1080-margin*2-gap)/2,tileH=480,top=148;
      imgs.forEach((img,i)=>{
        const x=margin+(i%2)*(tileW+gap),y=top+Math.floor(i/2)*(tileH+gap);
        ctx.save();ctx.beginPath();ctx.roundRect(x,y,tileW,tileH,24);ctx.clip();drawCover(ctx,img,x,y,tileW,tileH);ctx.restore();
        ctx.strokeStyle='#6f1d2b';ctx.lineWidth=4;ctx.strokeRect(x,y,tileW,tileH);
        ctx.fillStyle='rgba(18,18,18,.70)';ctx.fillRect(x,y+tileH-62,tileW,62);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='700 17px Arial,sans-serif';
        ctx.fillText((members[i].name||('MEMBER '+String(i+1).padStart(2,'0'))).toUpperCase(),x+16,y+tileH-24);
      });
      ctx.textAlign='center';ctx.fillStyle='#6f1d2b';ctx.font='700 37px Georgia,serif';ctx.fillText('WHO ARE YOUR FOUR?',540,1215);
      ctx.fillStyle='#173b4d';ctx.font='700 17px Arial,sans-serif';ctx.fillText('FIND YOUR FOUR  •  BRING YOUR FOUR  •  WATCH THE FOUR',540,1250);
      ctx.fillStyle='#665a54';ctx.font='15px Arial,sans-serif';ctx.fillText('FOUR CODE: '+fourCode,540,1290);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
      setArtwork(canvas.toDataURL('image/jpeg',.94));setArtworkBlob(blob);setStep(3);\n      void trackEvent(fourCode,'artwork_generated','web',{memberCount:4});\n      void trackEvent(fourCode,'artwork_generated','web',{memberCount:4});
    }finally{setBusy(false);}
  }

  function inviteUrl(){const u=new URL(window.location.href);u.searchParams.set('four',code||makeCode());return u.toString();}

  async function shareFour(){
    if(!artworkBlob)return;
    const url=inviteUrl(),text='I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR.';\n    void trackEvent(code,'shared','native_share');
    try{
      if(navigator.share){
        const file=new File([artworkBlob],'my-four-'+code+'.jpg',{type:'image/jpeg'});
        if(navigator.canShare?.({files:[file]})){await navigator.share({title:'My Four',text,url,files:[file]});return;}
        await navigator.share({title:'My Four',text,url});return;
      }
    }catch{}
    try{await navigator.clipboard.writeText(text+' '+url);}catch{}
    alert('Your Four invitation has been copied.');
  }

  function whatsapp(){const url=inviteUrl();void trackEvent(code,'shared','whatsapp');const text='I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR: '+url;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');}

  function download(){if(!artworkBlob)return;const a=document.createElement('a');a.href=URL.createObjectURL(artworkBlob);a.download='my-four-'+(code||'F4')+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

  async function register(){
    if(!regName.trim()||!regPhone.trim()||!consent){alert('Complete your name, phone and consent to continue.');return;}
    setBusy(true);setApiNote('');
    try{
      const finalCode=code||makeCode();setCode(finalCode);const res=await fetch('/api/fours',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:finalCode,name:regName.trim(),phone:regPhone.trim(),email:regEmail.trim(),consent})});
      const data=await res.json();
      if(!res.ok&&!data.demo)throw new Error(data.error||'Registration failed.');
      setRegistered(true);
      setApiNote(data.demo?'Prototype mode: registration remains local until the campaign database is connected.':'Your Four registration is saved.');
    }catch(e){
      setRegistered(true);
      setApiNote(e instanceof Error?e.message+' The prototype will keep your journey on this device.':'Prototype registration saved locally.');
    }finally{setBusy(false);}
  }

  async function chooseCinema(){
    if(!registered){alert('Register your Four first.');return;}
    if(!chosenCinema||!chosenDate||!chosenShowtime){alert('Choose your cinema, date and showtime.');return;}
    setBusy(true);
    try{
      const res=await fetch('/api/fours',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name:regName,phone:regPhone,email:regEmail,consent,memberNumber:memberNumber || 1,preferredCinema:chosenCinema,preferredDate:chosenDate,preferredShowtime:chosenShowtime})});
      if(!res.ok){const d=await res.json();if(!d.demo)throw new Error(d.error||'Could not save cinema choice.');}
      setApiNote('Cinema preference saved. The production version can now hand the group into the approved ticketing flow.');
    }catch(e){setApiNote(e instanceof Error?e.message:'Cinema selection captured for this prototype.');}
    finally{setBusy(false);}
  }

  const ticketingUrl=process.env.NEXT_PUBLIC_TICKETING_URL;

  return <main>
    <div className="invite-bar" hidden={!new URLSearchParams(typeof window!=='undefined'?window.location.search:'').get('four')}>YOU'VE BEEN INVITED TO JOIN A FOUR • CODE <strong>{code}</strong></div>
    <header className="topbar shell"><div className="wordmark">THE FOUR</div><div className="topbar-note">FIND YOUR FOUR • WAWO BRAND HOUSE</div></header>

    <section className="hero shell">
      <div className="hero-copy"><div className="eyebrow">NO ONE FIGHTS ALONE</div><h1>Everybody<br/><em>has a Four.</em></h1><p>The people you call first. The friends who show up. The people you want beside you when something big happens.</p><div className="hero-actions"><button className="btn btn-primary" onClick={()=>{setOpen(true);setStep(1)}}>Create My Four</button><a className="btn btn-ghost" href="#how">See how it works</a></div></div>
      <div className="hero-poster">{posterUrl?<img src={posterUrl} alt="THE FOUR official campaign artwork"/>:<><div className="poster-title">THE<br/><span>FOUR</span></div><div className="poster-note">IN CINEMAS<br/><strong>DECEMBER 11</strong></div><div className="poster-tag">NO ONE<br/>FIGHTS ALONE</div><div className="poster-four">4</div></>}</div>
    </section>

    <section id="how" className="section shell"><div className="eyebrow">THE CAMPAIGN LOOP</div><h2>Find. Create. Share. Watch.</h2><p className="lead">The campaign gives people something to do — and something to share — while creating a measurable path toward the cinema.</p><div className="step-grid">
      {[['01','Find','Choose the four people you want beside you.'],['02','Create','Build a personalised Four artwork from four photos.'],['03','Share','Invite your three and spread your Four.'],['04','Watch','Register, choose a cinema and complete the journey.']].map(([n,t,d])=><article className="step-card" key={n}><div className="step-no">{n}</div><h3>{t}</h3><p>{d}</p></article>)}
    </div></section>

    <section className="section shell feature"><div><div className="eyebrow">DIGITAL EXPERIENCE</div><h2>Your Four becomes the campaign.</h2><p className="lead">Capture four people, create a campaign-ready visual, share it natively and invite the other three through one unique Four link.</p><div className="mini-flow"><span>CAPTURE</span><b>→</b><span>CREATE</span><b>→</b><span>SHARE</span><b>→</b><span>WATCH</span></div><button className="btn btn-primary" onClick={()=>{setOpen(true);setStep(1)}}>Start the experience</button></div><div className="phone-card"><div className="phone"><div className="phone-label">Create Your Four</div><div className="phone-title">YOUR<br/>FOUR</div><div className="phone-faces">{[1,2,3,4].map(n=><div className="face" key={n}><span>0{n}</span></div>)}</div><button className="btn btn-primary" onClick={()=>{setOpen(true);setStep(1)}}>Generate</button></div></div></section>

    <section className="section shell"><div className="eyebrow">CAMPAIGN INTELLIGENCE</div><h2>The audience becomes measurable.</h2><p className="lead">With consent, the live platform can connect Four creation to registration, cinema selection, ticketing clicks and reward qualification.</p><div className="metrics">{['FOUR SQUADS CREATED','PEOPLE REGISTERED','CINEMA INTENT','TICKET / RSVP ACTIONS'].map(x=><div className="metric" key={x}><strong>—</strong><span>{x}</span></div>)}</div></section>

    <footer className="footer shell"><div className="eyebrow">WAWO BRAND HOUSE</div><h2>Let’s build<br/>the first Four.</h2><p>Prototype platform. Official movie artwork, talent likenesses, ticketing integrations, privacy language and reward mechanics require approval from the relevant rights holders and campaign partners.</p></footer>

    {open && <div className="modal" role="dialog" aria-modal="true"><div className="modal-card"><button className="modal-x" onClick={()=>{setOpen(false);reset()}} aria-label="Close">×</button><div className="eyebrow">FIND YOUR FOUR</div><div className="wizard-dots">{[1,2,3,4].map(n=><span key={n} className={step===n?'active':''}/>)}</div>
      {step===1&&<div className="wizard-panel"><h2>Start with your Four.</h2><p>Choose four people you want beside you. You can build it together or invite them one by one.</p><div className="modal-actions"><span/><button className="btn btn-primary" onClick={()=>setStep(2)}>Add My Four →</button></div></div>}
      {step===2&&<div className="wizard-panel"><h2>Add four photos.</h2><p>Use a group photo or upload four individual photos. The prototype keeps the exact Four structure: 01, 02, 03, 04.</p><div className="photo-grid">{members.map((m,i)=><div className="photo-slot" key={i}><div className="slot-head"><span>0{i+1}</span><small>MEMBER 0{i+1}</small></div><button className="preview-btn" onClick={()=>fileInputs.current[i]?.click()}>{m.preview?<img src={m.preview} alt="" />:<span>ADD PHOTO</span>}</button><input ref={el=>{fileInputs.current[i]=el}} type="file" accept="image/*" hidden onChange={e=>pick(i,e.target.files?.[0]||null)}/><input className="name-input" value={m.name} placeholder="Name (optional)" onChange={e=>setName(i,e.target.value)}/></div>)}</div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button><button className="btn btn-primary" disabled={busy} onClick={generateArtwork}>{busy?'Creating…':'Create My Four'}</button></div></div>}
      {step===3&&<div className="wizard-panel artwork-panel"><h2>YOUR FOUR IS READY.</h2>{artwork&&<img className="artwork" src={artwork} alt="Personalised Four campaign artwork"/>}<div className="code">FOUR CODE <strong>{code}</strong></div><p>Share the visual and invitation link with your Four. On supported phones, the native share sheet can share the image directly.</p><div className="share-actions"><button className="btn btn-primary" onClick={shareFour}>Share My Four</button><button className="btn btn-ghost" onClick={whatsapp}>WhatsApp</button><button className="btn btn-ghost" onClick={download}>Download</button></div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(2)}>Edit</button><button className="btn btn-primary" onClick={()=>setStep(4)}>Continue to Watch →</button></div></div>}
      {step===4&&<div className="wizard-panel"><h2>{isInvite?'You’ve been invited into this Four.':'Bring your Four to the cinema.'}</h2>{!registered?<><p>{isInvite?'Claim your place in this Four. Your registration adds you to the group and completes one of its four places.':'Register the Four captain first. In production, this becomes a consent-based campaign lead.'}</p><div className="form-row"><input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Your name"/><input value={regPhone} onChange={e=>setRegPhone(e.target.value)} placeholder="+234 phone"/><input value={regEmail} onChange={e=>setRegEmail(e.target.value)} placeholder="Email (optional)"/></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to receive campaign reminders and information about THE FOUR.</label><button className="btn btn-primary" disabled={busy} onClick={register}>{busy?'Saving…':'Register My Four'}</button>{apiNote&&<div className="inline-note">{apiNote}</div>}</>:<><div className="success"><strong>{isInvite?'You’ve joined Four '+code+'.':'Four '+code+' is registered.'}</strong>{memberNumber&&<><br/>You are member {String(memberNumber).padStart(2,'0')}.</>}<br/>{apiNote}</div>{reward?.qualified && <div className="reward-banner"><div className="eyebrow">FOUR EXPERIENCE</div><strong>Congratulations — your Four qualified.</strong><span>Reward code: {reward.reward_code}</span>{reward.rank&&<span>Place {reward.rank} of the first 500 qualifying Fours.</span>}</div>}<div className="cinema-card"><div className="eyebrow">CHOOSE YOUR CINEMA • DEMO INVENTORY</div><select value={chosenCinema} onChange={e=>{setChosenCinema(e.target.value);setChosenShowtime('')}}><option value="">Select a cinema</option>{CINEMAS.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select><input type="date" value={chosenDate} onChange={e=>setChosenDate(e.target.value)}/><select value={chosenShowtime} onChange={e=>setChosenShowtime(e.target.value)} disabled={!cinema}><option value="">Select a showtime</option>{cinema?.showtimes.map(t=><option key={t}>{t}</option>)}</select><button className="btn btn-primary" disabled={busy} onClick={chooseCinema}>{busy?'Saving…':'Save My Cinema Choice'}</button>{chosenCinema&&chosenDate&&chosenShowtime&&<div className="booking-row"><div><small>YOUR FOUR</small><strong>{chosenCinema}</strong><span>{chosenDate} • {chosenShowtime}</span></div>{ticketingUrl?<a className="btn btn-ghost" onClick={()=>void trackEvent(code,'ticket_clicked','web',{cinema:chosenCinema,showtime:chosenShowtime})} href={ticketingUrl} target="_blank" rel="noreferrer">Continue to Tickets →</a>:<button className="btn btn-ghost" onClick={()=>{void trackEvent(code,'ticket_clicked','web',{cinema:chosenCinema,showtime:chosenShowtime});alert('Ticketing partner link will be connected here in production.')}}>Continue to Tickets →</button>}</div>}</div></>}</div>}
    </div></div>}
  </main>
}
