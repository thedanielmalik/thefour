'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Member = { file: File | null; name: string; preview: string | null };

const EMPTY: Member[] = [1,2,3,4].map(() => ({ file: null, name: '', preview: null }));

function codeFromSeed() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'F4-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function cropDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export default function Home() {
  const [members, setMembers] = useState<Member[]>(EMPTY);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [artwork, setArtwork] = useState<string | null>(null);
  const [artworkBlob, setArtworkBlob] = useState<Blob | null>(null);
  const [registered, setRegistered] = useState(false);
  const fileInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const invited = new URLSearchParams(window.location.search).get('four');
    if (invited) {
      setCode(invited);
      setOpen(true);
      setStep(4);
    }
  }, []);

  const complete = useMemo(() => members.every(m => Boolean(m.file)), [members]);

  function reset() {
    members.forEach(m => { if (m.preview) URL.revokeObjectURL(m.preview); });
    setMembers(EMPTY);
    setArtwork(null);
    setArtworkBlob(null);
    setCode('');
    setRegistered(false);
    setStep(1);
  }

  function pick(index: number, file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    const preview = URL.createObjectURL(file);
    setMembers(prev => prev.map((m, i) => {
      if (i !== index) return m;
      if (m.preview) URL.revokeObjectURL(m.preview);
      return { ...m, file, preview };
    }));
  }

  function setName(index: number, name: string) {
    setMembers(prev => prev.map((m, i) => i === index ? { ...m, name } : m));
  }

  async function generate() {
    if (!complete) {
      window.alert('Add all four photos before creating your Four.');
      return;
    }
    const fourCode = code || codeFromSeed();
    setCode(fourCode);

    const imgs = await Promise.all(members.map(m => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = m.preview!;
    })));

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#f4efe5';
    ctx.fillRect(0,0,1080,1350);

    ctx.fillStyle = '#173b4d';
    ctx.font = '500 52px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE FOUR', 540, 76);

    ctx.fillStyle = '#6f1d2b';
    ctx.font = '700 20px Arial, sans-serif';
    ctx.fillText('NO ONE FIGHTS ALONE', 540, 110);

    const margin = 46;
    const gap = 16;
    const tileW = (1080 - margin*2 - gap) / 2;
    const tileH = 480;
    const top = 150;

    imgs.forEach((img, i) => {
      const x = margin + (i % 2) * (tileW + gap);
      const y = top + Math.floor(i / 2) * (tileH + gap);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, tileW, tileH, 26);
      ctx.clip();
      cropDraw(ctx, img, x, y, tileW, tileH);
      ctx.restore();
      ctx.strokeStyle = '#6f1d2b';
      ctx.lineWidth = 4;
      ctx.strokeRect(x,y,tileW,tileH);
      ctx.fillStyle = 'rgba(20,20,20,.68)';
      ctx.fillRect(x,y+tileH-62,tileW,62);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.font = '700 17px Arial, sans-serif';
      ctx.fillText((members[i].name || 'MEMBER ' + String(i+1).padStart(2,'0')).toUpperCase(), x+16, y+tileH-24);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6f1d2b';
    ctx.font = '700 38px Georgia, serif';
    ctx.fillText('WHO ARE YOUR FOUR?', 540, 1215);
    ctx.fillStyle = '#173b4d';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText('FIND YOUR FOUR  •  BRING YOUR FOUR  •  WATCH THE FOUR', 540, 1250);
    ctx.fillStyle = '#665a54';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('FOUR CODE: ' + fourCode, 540, 1290);

    const data = canvas.toDataURL('image/jpeg', .94);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,'image/jpeg',.94));
    setArtwork(data);
    setArtworkBlob(blob);
    setStep(3);
  }

  async function share() {
    if (!artworkBlob) return;
    const url = new URL(window.location.href);
    url.searchParams.set('four', code);
    const text = `I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR: ${url.toString()}`;
    try {
      if (navigator.share) {
        const file = new File([artworkBlob], `my-four-${code}.jpg`, { type:'image/jpeg' });
        if (navigator.canShare?.({ files:[file] })) {
          await navigator.share({ title:'My Four', text, files:[file] });
          return;
        }
        await navigator.share({ title:'My Four', text, url:url.toString() });
        return;
      }
    } catch {}
    try { await navigator.clipboard.writeText(text); } catch {}
    window.alert('Your Four invitation has been copied. Share it on WhatsApp, Instagram, TikTok or any chat.');
  }

  function shareWhatsApp() {
    const url = new URL(window.location.href);
    url.searchParams.set('four', code);
    const text = `I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR: ${url.toString()}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }

  function download() {
    if (!artworkBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(artworkBlob);
    a.download = `my-four-${code || 'F4'}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function openCreator() { setOpen(true); setStep(1); }
  function closeCreator() { setOpen(false); }

  return (
    <main>
      <div className="invite-bar" hidden={!new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('four')}>
        YOU'VE BEEN INVITED TO JOIN A FOUR • CODE <strong>{code}</strong>
      </div>

      <header className="topbar shell">
        <div className="wordmark">THE FOUR</div>
        <div className="topbar-note">FIND YOUR FOUR • A WAWO BRAND HOUSE CONCEPT</div>
      </header>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow">NO ONE FIGHTS ALONE</div>
          <h1>Everybody<br/><em>has a Four.</em></h1>
          <p>The people you call first. The friends who show up. The people you want beside you when something big happens.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={openCreator}>Create My Four</button>
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </div>
        </div>
        <div className="hero-poster">
          <div className="poster-top">THE FOUR</div>
          <div className="poster-mid">FIND YOUR FOUR</div>
          <div className="poster-bottom">BRING YOUR FOUR.<br/>WATCH THE FOUR.</div>
          <div className="poster-four">4</div>
        </div>
      </section>

      <section id="how" className="section shell">
        <div className="eyebrow">THE CAMPAIGN LOOP</div>
        <h2>Find. Create. Share. Watch.</h2>
        <p className="lead">A simple journey that turns friendship into personalised content, social participation and a path to the cinema.</p>
        <div className="step-grid">
          {[
            ['01','Find','Choose the four people you want beside you.'],
            ['02','Create','Build a personalised Four artwork from four photos.'],
            ['03','Share','Invite your three and share your Four across your channels.'],
            ['04','Watch','Choose your cinema journey and complete your Four.']
          ].map(([n,t,d]) => <article className="step-card" key={n}><div className="step-no">{n}</div><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>

      <section className="section shell feature">
        <div className="feature-copy">
          <div className="eyebrow">DIGITAL EXPERIENCE</div>
          <h2>Your Four becomes the campaign.</h2>
          <p>Upload four photos. Create the artwork. Share it. Invite the other three. The production-ready experience is designed for mobile first.</p>
          <div className="mini-flow"><span>CAPTURE</span><b>→</b><span>CREATE</span><b>→</b><span>SHARE</span><b>→</b><span>WATCH</span></div>
          <button className="btn btn-primary" onClick={openCreator}>Start the experience</button>
        </div>
        <div className="phone-card"><div className="phone"><div className="phone-label">Create Your Four</div><div className="phone-title">YOUR<br/>FOUR</div><div className="phone-faces">{[1,2,3,4].map(n=><div className="face" key={n}><span>0{n}</span></div>)}</div><button className="btn btn-primary">Generate</button></div></div>
      </section>

      <section className="section shell audience">
        <div className="eyebrow">CAMPAIGN INTELLIGENCE</div>
        <h2>The audience becomes measurable.</h2>
        <p className="lead">The live version can capture only the information necessary for the journey, with explicit consent, then connect participation to cinema intent and reward qualification.</p>
        <div className="metrics">{['FOUR SQUADS CREATED','PEOPLE REGISTERED','CINEMA INTENT','TICKET / RSVP ACTIONS'].map(m=><div className="metric" key={m}><strong>—</strong><span>{m}</span></div>)}</div>
      </section>

      <footer className="footer shell"><div className="eyebrow">WAWO BRAND HOUSE</div><h2>Let’s build<br/>the first Four.</h2><p>Prototype concept. Final movie artwork, talent likenesses, ticketing integrations, privacy language and reward mechanics require approval from the relevant rights holders and partners.</p></footer>

      {open && <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-card">
          <button className="modal-x" onClick={closeCreator} aria-label="Close">×</button>
          <div className="eyebrow">FIND YOUR FOUR</div>
          <div className="wizard-dots">{[1,2,3,4].map(n=><span className={step===n?'active':''} key={n}/>)}</div>

          {step===1 && <div className="wizard-panel"><h2>Start with your Four.</h2><p>Choose four people you want beside you. They can be together or invited separately.</p><button className="btn btn-primary" onClick={()=>setStep(2)}>Add My Four →</button></div>}

          {step===2 && <div className="wizard-panel"><h2>Add four photos.</h2><div className="photo-grid">{members.map((m,i)=><div className="photo-slot" key={i}>
            <div className="slot-head"><span>0{i+1}</span><small>MEMBER 0{i+1}</small></div>
            <button className="preview-btn" onClick={()=>fileInputs.current[i]?.click()}>{m.preview ? <img src={m.preview} alt="" /> : <span>ADD PHOTO</span>}</button>
            <input ref={el=>{fileInputs.current[i]=el}} type="file" accept="image/*" hidden onChange={e=>pick(i,e.target.files?.[0] || null)} />
            <input className="name-input" value={m.name} placeholder="Name (optional)" onChange={e=>setName(i,e.target.value)} />
          </div>)}</div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button><button className="btn btn-primary" onClick={generate}>Create My Four</button></div></div>}

          {step===3 && <div className="wizard-panel artwork-panel"><h2>YOUR FOUR IS READY.</h2>{artwork && <img className="artwork" src={artwork} alt="Your personalised Four artwork" />}<div className="code">FOUR CODE <strong>{code}</strong></div><div className="share-actions"><button className="btn btn-primary" onClick={share}>Share My Four</button><button className="btn btn-ghost" onClick={shareWhatsApp}>WhatsApp</button><button className="btn btn-ghost" onClick={download}>Download</button></div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(2)}>Edit</button><button className="btn btn-primary" onClick={()=>setStep(4)}>Register My Four →</button></div></div>}

          {step===4 && <div className="wizard-panel"><h2>Complete your Four.</h2><p>For the full campaign, this step connects to consent-based registration, cinema selection and the ticketing journey.</p><div className="form-row"><input placeholder="Your name" id="regName"/><input placeholder="+234 phone" id="regPhone"/></div><label className="consent"><input type="checkbox" id="consent"/> I agree to receive campaign reminders and information about THE FOUR.</label><button className="btn btn-primary" onClick={()=>{const n=(document.getElementById('regName') as HTMLInputElement)?.value.trim(); const p=(document.getElementById('regPhone') as HTMLInputElement)?.value.trim(); const c=(document.getElementById('consent') as HTMLInputElement)?.checked; if(!n||!p||!c){alert('Complete your details and consent to continue.');return} setRegistered(true)}}>{registered?'Registered ✓':'Register My Four'}</button>{registered && <div className="success">You are registered for this prototype journey. Four code: <strong>{code}</strong></div>}</div>}
        </div>
      </div>}
    </main>
  );
}
