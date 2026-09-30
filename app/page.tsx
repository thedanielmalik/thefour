'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fourApi } from '../lib/four-api';

type Member = { file: File | null; name: string; preview: string | null };
type Cinema = { name: string; area: string; showtimes: string[] };
type TemplateId = 'editorial' | 'sunset' | 'magazine' | 'bold';
type ActivityItem = { display_name:string; member_number:number; joined_at:string|null; member_count:number; status:string };
type RewardCard = { card_code:string; status:string; issued_at:string; claimed_at?:string|null; creator_name:string; members:Array<{member_number:number;name:string|null}> };

// DEMO inventory only. Replace with approved partner/cinema feed before launch.
const CINEMAS: Cinema[] = [
  { name: 'Genesis Deluxe Cinemas — Maryland (DEMO)', area: 'Lagos', showtimes: ['12:30 PM','3:15 PM','6:00 PM','8:45 PM'] },
  { name: 'Filmhouse Cinemas — Lekki (DEMO)', area: 'Lagos', showtimes: ['1:00 PM','3:45 PM','6:30 PM','9:15 PM'] },
  { name: 'Filmhouse Cinemas — Surulere (DEMO)', area: 'Lagos', showtimes: ['12:15 PM','3:00 PM','5:45 PM','8:30 PM'] },
  { name: 'Genesis Deluxe Cinemas — Ikeja (DEMO)', area: 'Lagos', showtimes: ['12:45 PM','3:30 PM','6:15 PM','9:00 PM'] }
];

const freshMembers = (): Member[] => [1,2,3,4].map(() => ({ file:null, name:'', preview:null }));

async function trackEvent(code: string | undefined, eventType: 'created'|'photo_uploaded'|'artwork_generated'|'shared'|'invited'|'member_joined'|'registered'|'cinema_selected'|'ticket_clicked'|'reward_qualified'|'reward_claimed'|'attended', channel?: string, metadata?: Record<string, unknown>) {
  try { await fourApi('/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,eventType,channel,metadata})}); } catch {}
}

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return 'F4-' + Array.from(values, value => chars[value % chars.length]).join('');
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w/img.width,h/img.height);
  const sw = w/scale, sh = h/scale;
  ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);
}

const FLYER_WIDTH = 1080;
const FLYER_HEIGHT = 1350;
const RELEASE_DATE = 'DECEMBER 11';
const RELEASE_YEAR = '2026';

const TEMPLATE_META: Array<{id: TemplateId; name: string; note: string}> = [
  {id:'editorial',name:'Editorial',note:'Cream cover • premium magazine feel'},
  {id:'sunset',name:'Sunset',note:'Orange cinema glow • bold and warm'},
  {id:'magazine',name:'Magazine',note:'Clean cover • four vertical portraits'},
  {id:'bold',name:'Bold',note:'Navy • gold • statement poster'}
];

function drawFlyerBackground(ctx:CanvasRenderingContext2D, template:TemplateId, w:number, h:number, navy:string, orange:string, cream:string, gold:string, wine:string){
  const drawArc=(cx:number,cy:number,r:number,start:number,end:number,color:string,width:number)=>{
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.stroke();
  };
  const drawGlow=(x:number,y:number,r:number,inner:string,outer:string)=>{
    const g=ctx.createRadialGradient(x,y,4,x,y,r);
    g.addColorStop(0,inner);g.addColorStop(.35,inner);g.addColorStop(1,outer);
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  };
  const skyline=(baseY:number,maxH:number)=>{
    ctx.fillStyle='rgba(13,27,61,.78)';
    for(let x=0;x<w;x+=34+((x/34)%3)*10){
      const bh=maxH*(0.22+(((x*17)%100)/100)*0.78);
      const bw=18+((x/17)%4)*7;
      ctx.fillRect(x,baseY-bh,bw,bh);
      ctx.fillStyle='rgba(218,175,55,.55)';
      for(let wy=baseY-bh+14;wy<baseY-10;wy+=20){ if(((wy+x)%37)<18)ctx.fillRect(x+5,wy,4,7); }
      ctx.fillStyle='rgba(13,27,61,.78)';
    }
  };

  ctx.save();

  if(template==='editorial'){
    ctx.fillStyle=cream;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=navy;ctx.fillRect(0,920,w,430);

    drawGlow(170,260,500,'rgba(242,109,33,.55)','rgba(242,109,33,0)');
    ctx.fillStyle='rgba(218,175,55,.16)';ctx.beginPath();ctx.arc(890,250,210,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(13,27,61,.035)';ctx.font='900 520px Georgia,serif';ctx.textAlign='right';ctx.fillText('04',1040,840);

    drawArc(115,1180,340,-1.05,0.45,'rgba(242,109,33,.35)',10);
    drawArc(60,1140,250,-1.05,0.55,'rgba(218,175,55,.36)',5);
    drawArc(980,1180,430,2.15,3.8,'rgba(255,246,233,.16)',9);

    ctx.fillStyle='rgba(13,27,61,.07)';
    for(let i=0;i<4;i++){ctx.fillRect(52+i*244,320,210,4);}
    skyline(1335,160);

    ctx.fillStyle='rgba(255,246,233,.08)';
    for(let i=0;i<4;i++){ctx.fillRect(52+i*244,340,210,430);}
  }

  if(template==='sunset'){
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,orange);g.addColorStop(.38,'#f09a38');g.addColorStop(.64,wine);g.addColorStop(1,navy);
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    drawGlow(170,205,470,'rgba(255,246,233,.55)','rgba(255,246,233,0)');
    drawGlow(890,850,520,'rgba(218,175,55,.25)','rgba(218,175,55,0)');
    ctx.fillStyle='rgba(13,27,61,.11)';ctx.beginPath();ctx.arc(850,360,300,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,246,233,.15)';ctx.lineWidth=3;
    for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(-80+i*150,0);ctx.lineTo(430+i*150,h);ctx.stroke();}
    drawArc(110,1120,320,-.8,.7,'rgba(218,175,55,.38)',9);
    drawArc(990,1050,340,2.5,4.15,'rgba(255,246,233,.22)',7);
    ctx.fillStyle='rgba(13,27,61,.16)';ctx.font='900 600px Georgia,serif';ctx.textAlign='right';ctx.fillText('4',1060,580);
    skyline(1350,210);
  }

  if(template==='magazine'){
    ctx.fillStyle='#fbf7ef';ctx.fillRect(0,0,w,h);
    ctx.fillStyle=navy;ctx.fillRect(0,1140,w,210);
    drawGlow(910,180,360,'rgba(242,109,33,.24)','rgba(242,109,33,0)');
    ctx.fillStyle='rgba(218,175,55,.18)';ctx.beginPath();ctx.arc(920,205,120,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(13,27,61,.10)';ctx.lineWidth=4;
    for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(0,1010+i*50);ctx.quadraticCurveTo(330,920+i*65,1080,1090+i*45);ctx.stroke();}
    drawArc(80,250,310,-.8,1.1,'rgba(242,109,33,.28)',8);
    drawArc(1000,1180,300,2.7,4.5,'rgba(218,175,55,.38)',6);
    ctx.fillStyle='rgba(13,27,61,.045)';ctx.font='900 430px Georgia,serif';ctx.textAlign='right';ctx.fillText('FOUR',1060,1190);
    for(let i=0;i<4;i++){ctx.fillStyle=i%2===0?'rgba(242,109,33,.12)':'rgba(218,175,55,.13)';ctx.fillRect(34+i*255,300,220,650);}
    skyline(1350,120);
  }

  if(template==='bold'){
    ctx.fillStyle=navy;ctx.fillRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(242,109,33,.34)');g.addColorStop(.38,'rgba(111,29,43,.30)');g.addColorStop(.72,'rgba(218,175,55,.16)');g.addColorStop(1,'rgba(13,27,61,.04)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    drawGlow(170,170,360,'rgba(242,109,33,.28)','rgba(242,109,33,0)');
    ctx.fillStyle='rgba(218,175,55,.12)';ctx.beginPath();ctx.arc(155,260,175,0,Math.PI*2);ctx.fill();
    drawArc(950,160,270,-1.2,1.8,'rgba(255,246,233,.18)',7);
    drawArc(1030,1070,420,2.2,4.65,'rgba(218,175,55,.35)',10);
    for(let i=0;i<4;i++){ctx.fillStyle=i%2===0?'rgba(242,109,33,.12)':'rgba(255,246,233,.045)';ctx.fillRect(70+i*240,235,215,820);}
    ctx.fillStyle='rgba(255,246,233,.05)';ctx.font='900 530px Georgia,serif';ctx.textAlign='right';ctx.fillText('04',1050,600);
    skyline(1350,190);
  }

  // Fine grain-like texture made from low-contrast dots for a more premium printed finish.
  ctx.globalAlpha=.07;
  ctx.fillStyle='#fff';
  for(let y=0;y<h;y+=12){for(let x=(y%24);x<w;x+=12){ctx.fillRect(x,y,1,1);}}
  ctx.globalAlpha=1;
  ctx.restore();
}
function roundedPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x:number, y:number, w:number, h:number, radius:number, border:string, lineWidth=3) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,radius);
  ctx.clip();
  drawCover(ctx,img,x,y,w,h);
  ctx.restore();
  ctx.strokeStyle=border;
  ctx.lineWidth=lineWidth;
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,radius);
  ctx.stroke();
}

function textFit(ctx: CanvasRenderingContext2D, text:string, maxWidth:number, startSize:number, minSize:number, fontFamily:string, weight:string) {
  let size=startSize;
  while(size>minSize){
    ctx.font=weight+' '+size+'px '+fontFamily;
    if(ctx.measureText(text).width<=maxWidth)break;
    size-=2;
  }
  return size;
}

async function makeFourFlyer(imgs:HTMLImageElement[], members:Member[], codeValue:string, template:TemplateId) {
  const canvas=document.createElement('canvas');
  canvas.width=FLYER_WIDTH;canvas.height=FLYER_HEIGHT;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Could not create flyer.');
  const navy='#0D1B3D', orange='#F26D21', cream='#FFF6E9', gold='#DAAF37', wine='#6f1d2b', ink='#171616', white='#fff';

  ctx.textBaseline='alphabetic';

  if(template==='editorial'){
    drawFlyerBackground(ctx,'editorial',FLYER_WIDTH,FLYER_HEIGHT,navy,orange,cream,gold,wine);
    ctx.fillStyle=navy;ctx.textAlign='center';ctx.font='700 18px Arial,sans-serif';ctx.fillText('A FUNKE AKINDELE FILM',540,48);
    ctx.fillStyle=orange;ctx.font='900 116px Georgia,serif';ctx.fillText('THE',540,152);
    ctx.fillStyle=navy;ctx.font='500 150px Georgia,serif';ctx.fillText('FOUR',540,268);
    ctx.fillStyle=wine;ctx.font='800 22px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,302);
    const margin=52,gap=18,tileW=(1080-margin*2-gap)/2,tileH=430,top=340;
    imgs.forEach((img,i)=>{
      const x=margin+(i%2)*(tileW+gap),y=top+Math.floor(i/2)*(tileH+gap);
      roundedPhoto(ctx,img,x,y,tileW,tileH,18,wine,4);
      ctx.fillStyle='rgba(13,27,61,.82)';ctx.fillRect(x,y+tileH-60,tileW,60);
      ctx.fillStyle=white;ctx.textAlign='left';ctx.font='700 17px Arial,sans-serif';ctx.fillText((members[i].name||('MEMBER '+String(i+1).padStart(2,'0'))).toUpperCase(),x+16,y+tileH-23);
      ctx.fillStyle=gold;ctx.textAlign='right';ctx.font='900 18px Arial,sans-serif';ctx.fillText('0'+(i+1),x+tileW-16,y+tileH-23);
    });
    ctx.fillStyle=orange;ctx.fillRect(52,1234,976,4);
    ctx.fillStyle=navy;ctx.textAlign='left';ctx.font='800 18px Arial,sans-serif';ctx.fillText('WHO ARE YOUR FOUR?',52,1282);
    ctx.textAlign='right';ctx.fillText('IN CINEMAS '+RELEASE_DATE,1028,1282);
    ctx.fillStyle=wine;ctx.font='700 14px Arial,sans-serif';ctx.fillText('DECEMBER '+RELEASE_YEAR,1028,1307);
    ctx.textAlign='center';ctx.fillStyle=navy;ctx.font='700 13px Arial,sans-serif';ctx.fillText('FIND YOUR FOUR  •  BRING YOUR FOUR  •  WATCH THE FOUR',540,1335);
  }

  if(template==='sunset'){
    drawFlyerBackground(ctx,'sunset',FLYER_WIDTH,FLYER_HEIGHT,navy,orange,cream,gold,wine);
    ctx.fillStyle='rgba(255,246,233,.10)';ctx.textAlign='right';ctx.font='900 480px Georgia,serif';ctx.fillText('4',1060,530);
    ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='700 17px Arial,sans-serif';ctx.fillText('A FUNKE AKINDELE FILM',540,50);
    ctx.font='900 118px Georgia,serif';ctx.fillText('THE FOUR',540,152);
    ctx.font='800 20px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,185);
    const margin=34,gap=9,tileW=(1080-margin*2-gap*3)/4,tileH=680,top=236;
    imgs.forEach((img,i)=>{
      const x=margin+i*(tileW+gap);
      roundedPhoto(ctx,img,x,top,tileW,tileH,16,cream,3);
      const overlay=ctx.createLinearGradient(0,top,0,top+tileH);overlay.addColorStop(.58,'rgba(13,27,61,0)');overlay.addColorStop(1,'rgba(13,27,61,.88)');
      ctx.fillStyle=overlay;ctx.beginPath();ctx.roundRect(x,top,tileW,tileH,16);ctx.fill();
      ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='800 13px Arial,sans-serif';ctx.fillText((members[i].name||'MEMBER 0'+(i+1)).toUpperCase(),x+tileW/2,top+tileH-26);
    });
    ctx.fillStyle=gold;ctx.fillRect(34,948,1012,3);
    ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='900 34px Georgia,serif';ctx.fillText('YOUR FOUR.',34,1004);
    ctx.font='800 17px Arial,sans-serif';ctx.fillText('ONE VISUAL. ONE SQUAD. ONE NIGHT TO REMEMBER.',34,1033);
    ctx.textAlign='right';ctx.font='900 34px Georgia,serif';ctx.fillText(RELEASE_DATE,1046,1004);
    ctx.font='800 16px Arial,sans-serif';ctx.fillText('IN CINEMAS • '+RELEASE_YEAR,1046,1033);
    ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='700 14px Arial,sans-serif';ctx.fillText('FOUR CODE  •  '+codeValue,540,1288);
    ctx.fillStyle=gold;ctx.font='900 30px Georgia,serif';ctx.fillText('FIND YOUR FOUR',540,1330);
  }

  if(template==='magazine'){
    drawFlyerBackground(ctx,'magazine',FLYER_WIDTH,FLYER_HEIGHT,navy,orange,cream,gold,wine);
    ctx.fillStyle=navy;ctx.textAlign='left';ctx.font='800 17px Arial,sans-serif';ctx.fillText('THE FOUR / NO. 01 / '+RELEASE_YEAR,42,42);
    ctx.textAlign='right';ctx.fillText('A FUNKE AKINDELE FILM',1038,42);
    ctx.textAlign='center';ctx.fillStyle=navy;
    const titleSize=textFit(ctx,'THE FOUR',950,144,104,'Georgia,serif','500');ctx.font='500 '+titleSize+'px Georgia,serif';ctx.fillText('THE FOUR',540,176);
    ctx.fillStyle=orange;ctx.font='800 19px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,214);
    const margin=34,gap=10,tileW=(1080-margin*2-gap*3)/4,tileH=850,top=258;
    imgs.forEach((img,i)=>{
      const x=margin+i*(tileW+gap);
      roundedPhoto(ctx,img,x,top,tileW,tileH,8,navy,2);
      ctx.fillStyle=cream;ctx.fillRect(x+8,top+12,62,32);
      ctx.fillStyle=navy;ctx.textAlign='center';ctx.font='900 14px Arial,sans-serif';ctx.fillText('0'+(i+1),x+39,top+34);
      ctx.save();ctx.translate(x+tileW/2,top+tileH-24);ctx.fillStyle=white;ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=8;ctx.font='800 12px Arial,sans-serif';ctx.fillText((members[i].name||'MEMBER 0'+(i+1)).toUpperCase(),0,0);ctx.restore();
    });
    ctx.fillStyle=orange;ctx.fillRect(34,1144,1012,86);
    ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='900 34px Georgia,serif';ctx.fillText('WHO ARE YOUR FOUR?',52,1198);
    ctx.fillStyle=navy;ctx.textAlign='right';ctx.font='900 26px Arial,sans-serif';ctx.fillText('IN CINEMAS '+RELEASE_DATE,1028,1188);ctx.font='800 15px Arial,sans-serif';ctx.fillText(RELEASE_YEAR,1028,1212);
    ctx.fillStyle=navy;ctx.textAlign='center';ctx.font='800 13px Arial,sans-serif';ctx.fillText('CREATE YOUR FOUR • SHARE YOUR FOUR • WATCH THE FOUR',540,1268);
    ctx.fillStyle=wine;ctx.font='700 14px Arial,sans-serif';ctx.fillText('FOUR CODE  '+codeValue,540,1296);
    ctx.fillStyle=gold;ctx.fillRect(420,1314,240,4);
  }

  if(template==='bold'){
    drawFlyerBackground(ctx,'bold',FLYER_WIDTH,FLYER_HEIGHT,navy,orange,cream,gold,wine);
    ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='800 18px Arial,sans-serif';ctx.fillText('A FUNKE AKINDELE FILM',44,50);
    ctx.fillStyle=gold;ctx.textAlign='right';ctx.fillText(RELEASE_YEAR,1036,50);
    ctx.textAlign='center';ctx.fillStyle=cream;ctx.font='900 112px Georgia,serif';ctx.fillText('THE FOUR',540,160);
    ctx.fillStyle=orange;ctx.font='800 20px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,198);
    const positions=[[70,250],[557,250],[70,690],[557,690]];
    imgs.forEach((img,i)=>{
      const [x,y]=positions[i];
      roundedPhoto(ctx,img,x,y,453,390,28,gold,4);
      ctx.fillStyle='rgba(13,27,61,.72)';ctx.fillRect(x,y+324,453,66);
      ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='800 15px Arial,sans-serif';ctx.fillText((members[i].name||'MEMBER 0'+(i+1)).toUpperCase(),x+18,y+364);
      ctx.fillStyle=gold;ctx.textAlign='right';ctx.font='900 22px Georgia,serif';ctx.fillText('0'+(i+1),x+433,y+365);
    });
    ctx.fillStyle=orange;ctx.fillRect(70,1134,940,7);
    ctx.fillStyle=cream;ctx.textAlign='left';ctx.font='900 44px Georgia,serif';ctx.fillText('WHO ARE YOUR FOUR?',70,1210);
    ctx.font='800 17px Arial,sans-serif';ctx.fillText('IN CINEMAS '+RELEASE_DATE+' • '+RELEASE_YEAR,70,1243);
    ctx.fillStyle=gold;ctx.textAlign='right';ctx.font='900 20px Arial,sans-serif';ctx.fillText('FIND YOUR FOUR',1010,1243);
    ctx.fillStyle=cream;ctx.textAlign='center';ctx.font='700 13px Arial,sans-serif';ctx.fillText('FOUR CODE  •  '+codeValue,540,1298);
    ctx.fillStyle=gold;ctx.font='900 30px Georgia,serif';ctx.fillText('NO ONE FIGHTS ALONE',540,1334);
  }

  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));
  return {dataUrl:canvas.toDataURL('image/jpeg',.95),blob};
}

export default function Home() {
  const [members,setMembers]=useState<Member[]>(freshMembers);
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState<1|2|3|4>(1);
  const [code,setCode]=useState('');
  const [artwork,setArtwork]=useState<string|null>(null);
  const [artworkBlob,setArtworkBlob]=useState<Blob|null>(null);
  const [busy,setBusy]=useState(false);
  const [registered,setRegistered]=useState(false);
  const [isInvite,setIsInvite]=useState(false);
  const [memberNumber,setMemberNumber]=useState<number|null>(null);
  const [chosenCinema,setChosenCinema]=useState('');
  const [chosenShowtime,setChosenShowtime]=useState('');
  const [chosenDate,setChosenDate]=useState('');
  const [regName,setRegName]=useState('');
  const [regPhone,setRegPhone]=useState('');
  const [regEmail,setRegEmail]=useState('');
  const [consent,setConsent]=useState(false);
  const [apiNote,setApiNote]=useState('');
  const [inviteMembers,setInviteMembers]=useState<Array<{member_number:number;name:string|null;photo_url?:string|null;shared?:boolean;share_channel?:string|null;share_confirmed_at?:string|null}>>([]);
  const [invitePhoto,setInvitePhoto]=useState<File|null>(null);
  const [invitePhotoPreview,setInvitePhotoPreview]=useState<string|null>(null);
  const [reward,setReward]=useState<{qualified:boolean;reward_code:string|null;rank:number|null}|null>(null);
  const [sharedArtworkUrl,setSharedArtworkUrl]=useState<string|null>(null);
  const [selectedTemplate,setSelectedTemplate]=useState<TemplateId>('editorial');
  const [publicActivityOptIn,setPublicActivityOptIn]=useState(false);
  const [shareConfirmed,setShareConfirmed]=useState(false);
  const [rewardCard,setRewardCard]=useState<RewardCard|null>(null);
  const [activity,setActivity]=useState<ActivityItem[]>([]);
  const fileInputs=useRef<Array<HTMLInputElement|null>>([]);

  const posterUrl = process.env.NEXT_PUBLIC_THE_FOUR_POSTER_URL || '';
  const complete = useMemo(()=>members.every(m=>Boolean(m.file)),[members]);
  const cinema = CINEMAS.find(c=>c.name===chosenCinema);

  useEffect(()=>{
    const invited=new URLSearchParams(window.location.search).get('four');
    if(invited){setCode(invited);setIsInvite(true);setOpen(true);setStep(4);setApiNote('Loading the Four…'); refreshSquad(invited).then(()=>setApiNote('You have been invited into an existing Four. Claim your place below.')).catch(()=>setApiNote('Complete your details below to claim your place.'));}
  },[]);
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const res=await fourApi('/activity?limit=12');
        const data=await res.json();
        if(active && res.ok && Array.isArray(data.items)) setActivity(data.items);
      }catch{}
    };
    void load();
    const timer=window.setInterval(load,5000);
    return()=>{active=false;window.clearInterval(timer)};
  },[]);
  useEffect(()=>{
    if(!registered || !code || !memberNumber || !regPhone) return;
    let active=true;
    const load=async()=>{
      const data=await refreshSquad(code);
      if(!active || !data) return;
      const me=(Array.isArray(data.members)?data.members:[]).find((m:{member_number:number})=>Number(m.member_number)===Number(memberNumber));
      if(me) setShareConfirmed(Boolean(me.shared));
      if(memberNumber===1){
        try{
          const res=await fourApi('/card?code='+encodeURIComponent(code)+'&phone='+encodeURIComponent(regPhone));
          const cardData=await res.json();
          if(active) setRewardCard(res.ok && cardData.card ? cardData.card : null);
        }catch{}
      }
    };
    void load();
    const timer=window.setInterval(load,5000);
    return()=>{active=false;window.clearInterval(timer)};
  },[registered,code,memberNumber,regPhone]);

  function reset() {
    members.forEach(m=>m.preview&&URL.revokeObjectURL(m.preview));
    setMembers(freshMembers());setArtwork(null);setArtworkBlob(null);setCode('');setRegistered(false);
    setChosenCinema('');setChosenShowtime('');setChosenDate('');setRegName('');setRegPhone('');setRegEmail('');
    setConsent(false);setPublicActivityOptIn(false);setShareConfirmed(false);setRewardCard(null);setActivity([]);setApiNote('');setMemberNumber(null);setInviteMembers([]);setSharedArtworkUrl(null);setInvitePhoto(null);if(invitePhotoPreview)URL.revokeObjectURL(invitePhotoPreview);setInvitePhotoPreview(null);setIsInvite(false);setStep(1);
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

  async function fileToDataUrl(file:File){
    return await new Promise<string>((resolve,reject)=>{
      const src=URL.createObjectURL(file);const img=new Image();
      img.onload=()=>{ URL.revokeObjectURL(src); const max=1400; const scale=Math.min(1,max/Math.max(img.width,img.height)); const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');if(!ctx){reject(new Error('Could not prepare photo.'));return;}ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.84)); };
      img.onerror=()=>{URL.revokeObjectURL(src);reject(new Error('Could not read photo.'));}; img.src=src;
    });
  }

  async function persistPhoto(codeValue:string,memberNo:number,file:File,phone:string){
    const dataUrl=await fileToDataUrl(file); const res=await fourApi('/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:codeValue,memberNumber:memberNo,phone,dataUrl})});
    if(!res.ok){const d=await res.json();throw new Error(d.error||'Could not save photo.');}
    return (await res.json()).photo_url as string;
  }

  async function persistArtwork(codeValue:string,dataUrl:string,phone:string){
    const res=await fourApi('/artwork',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:codeValue,phone,dataUrl})});
    if(!res.ok){const d=await res.json();throw new Error(d.error||'Could not save artwork.');}
    return (await res.json()).artwork_url as string;
  }

  async function refreshSquad(codeValue:string){
    try{ const res=await fourApi('/fours?code='+encodeURIComponent(codeValue)); const data=await res.json(); if(Array.isArray(data.members))setInviteMembers(data.members); setSharedArtworkUrl(data.squad?.artwork_url||null); return data; }catch{return null;}
  }

  async function confirmMemberShare(channel:string){
    if(!registered || !code || !memberNumber || !regPhone){setStep(4);setApiNote('Register your Four first so your share can be confirmed.');return false;}
    setBusy(true);setApiNote('Confirming your share…');
    try{
      const res=await fourApi('/share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,memberNumber,phone:regPhone,channel})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Could not confirm your share.');
      setShareConfirmed(true);
      await refreshSquad(code);
      if(memberNumber===1 && data.rewardCard) setRewardCard(data.rewardCard);
      setApiNote(data.cardIssued && memberNumber===1 ? 'All four shares are confirmed. Your creator reward card is ready.' : 'Your share is confirmed. The Four Room has been updated.');
      return true;
    }catch(e){setApiNote(e instanceof Error?e.message:'Could not confirm your share.');return false;}
    finally{setBusy(false);}
  }

  async function refreshSharedArtwork(){
    if(!code)return;
    setBusy(true);setApiNote('Preparing the shared Four flyer…');
    try{
      const data=await refreshSquad(code);
      const current: Array<{member_number:number;name:string|null;photo_url?:string|null}> = Array.isArray(data?.members) ? data.members : [];
      if(current.length<4 || current.some((m:{photo_url?:string|null})=>!m.photo_url)) throw new Error('All four members need a photo before the shared flyer can be refreshed.');
      const ordered=current.slice().sort((a:{member_number:number},b:{member_number:number})=>a.member_number-b.member_number);
      const imgs=await Promise.all(ordered.map((m:{photo_url?:string|null})=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load one Four photo.'));img.src=m.photo_url!;})));
      const flyerMembers=ordered.map(m=>({file:null,name:m.name||'',preview:m.photo_url||null}));
      const made=await makeFourFlyer(imgs,flyerMembers,code,selectedTemplate);
      setArtwork(made.dataUrl);setArtworkBlob(made.blob);
      const persisted=await persistArtwork(code,made.dataUrl,regPhone);
      setSharedArtworkUrl(persisted);
      setApiNote('Your shared Four flyer has been refreshed for everyone in the Four Room.');
      void trackEvent(code,'artwork_generated','web',{memberCount:4,persisted:true,template:selectedTemplate});
    }catch(e){setApiNote(e instanceof Error?e.message:'Could not refresh the shared Four flyer.');}
    finally{setBusy(false);}
  }

  async function generateArtwork(){
    if(!complete){alert('Add all four photos before creating your flyer.');return;}
    setBusy(true);
    try{
      const imgs=await Promise.all(members.map(m=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=m.preview!;})));
      const fourCode=code||makeCode();setCode(fourCode);
      const made=await makeFourFlyer(imgs,members,fourCode,selectedTemplate);
      setArtwork(made.dataUrl);setArtworkBlob(made.blob);setStep(3);
      void trackEvent(fourCode,'artwork_generated','web',{memberCount:4,template:selectedTemplate});
    }catch(e){setApiNote(e instanceof Error?e.message:'Could not create your Four flyer.');}
    finally{setBusy(false);}
  }

  function inviteUrl(){const u=new URL(window.location.href);const base=u.pathname.replace(/\/?$/,'/');u.pathname=base+'four/';u.search='';u.searchParams.set('code',code||makeCode());return u.toString();}

  async function shareFour(){
    if(!artworkBlob)return;
    if(!registered){setStep(4);setApiNote('Register your Four first so the invitation link opens a live Four Room.');return;}
    const url=inviteUrl(),text='I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR — in cinemas December 11.';
    try{
      if(navigator.share){
        const file=new File([artworkBlob],'my-four-'+code+'.jpg',{type:'image/jpeg'});
        if(navigator.canShare?.({files:[file]})){await navigator.share({title:'My Four',text,url,files:[file]});await confirmMemberShare('native_share');return;}
        await navigator.share({title:'My Four',text,url});await confirmMemberShare('native_share');return;
      }
    }catch{}
    try{await navigator.clipboard.writeText(text+' '+url);void trackEvent(code,'shared','clipboard');}catch{}
    setApiNote('Invitation copied. After you post/share it, tap “I Shared” to confirm your share.');
  }

  function whatsapp(){if(!registered){setStep(4);setApiNote('Register your Four first so the invitation link opens a live Four Room.');return;}const url=inviteUrl();const text='I found my Four. ❤️ You are one of mine. Join my Four for THE FOUR: '+url;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');void trackEvent(code,'shared','whatsapp');setApiNote('WhatsApp opened. After sending, return here and tap “I Shared” to confirm your share.');}

  function download(){if(!artworkBlob)return;const a=document.createElement('a');a.href=URL.createObjectURL(artworkBlob);a.download='my-four-'+(code||'F4')+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}

  async function register(){
    if(!regName.trim()||!regPhone.trim()||!consent){alert('Complete your name, phone and consent to continue.');return;}
    if(isInvite && !invitePhoto){alert('Add your photo to claim your place in the Four.');return;}
    setBusy(true);setApiNote('');
    try{
      const finalCode=(code||makeCode()).trim().toUpperCase();setCode(finalCode);const res=await fourApi('/fours',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:finalCode,name:regName.trim(),phone:regPhone.trim(),email:regEmail.trim(),consent,publicActivityOptIn})});
      const data=await res.json();
      if(!res.ok&&!data.demo)throw new Error(data.error||'Registration failed.');
      setRegistered(true);
      setMemberNumber(Number(data.memberNumber||1));
      let syncError='';
      try{
        if(finalCode && isInvite && invitePhoto && data.memberNumber) await persistPhoto(finalCode,Number(data.memberNumber),invitePhoto,regPhone.trim());
        if(finalCode && !isInvite && members[0]?.file) await persistPhoto(finalCode,1,members[0].file,regPhone.trim());
        if(finalCode && artwork) await persistArtwork(finalCode,artwork,regPhone.trim());
        await refreshSquad(finalCode);
        const rr=await fourApi('/reward',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:finalCode})});
        if(rr.ok){const rd=await rr.json();setReward(rd.qualified!==undefined?rd:null);}
      }catch(syncErrorValue){syncError=syncErrorValue instanceof Error?syncErrorValue.message:'Registration saved, but one media item still needs to sync.';}
      setApiNote(syncError || (data.demo?'Prototype mode: registration remains local until the campaign database is connected.':'Your Four registration is saved and your Four Room is live.'));
    }catch(e){
      setRegistered(false);
      setApiNote(e instanceof Error?e.message:'Registration failed. Please try again.');
    }finally{setBusy(false);}
  }

  async function chooseCinema(){
    if(!registered){alert('Register your Four first.');return;}
    if(!chosenCinema||!chosenDate||!chosenShowtime){alert('Choose your cinema, date and showtime.');return;}
    setBusy(true);
    try{
      const res=await fourApi('/fours',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name:regName,phone:regPhone,email:regEmail,consent,memberNumber:memberNumber || 1,preferredCinema:chosenCinema,preferredDate:chosenDate,preferredShowtime:chosenShowtime})});
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
      <div className="hero-poster">{posterUrl?<img src={posterUrl} alt="THE FOUR official campaign artwork"/>:<><div className="poster-kicker">A FUNKE AKINDELE FILM</div><div className="poster-title">THE<br/><span>FOUR</span></div><div className="poster-sub">NO ONE FIGHTS ALONE</div><div className="poster-silhouette">{[1,2,3,4].map(n=><span key={n}>{n}</span>)}</div><div className="poster-note">IN CINEMAS<br/><strong>DECEMBER 11</strong></div><div className="poster-year">2026</div></>}</div>
    </section>

    <section className="section shell live-feed-section"><div className="eyebrow">LIVE FROM THE FOUR</div><div className="live-feed-head"><div><h2>The Four is growing.</h2><p className="lead">Real-time campaign activity from people who chose to appear on the public feed.</p></div><span className="live-dot">LIVE</span></div><div className="live-feed-grid">{activity.length?activity.slice(0,8).map((item,i)=>{const places=Math.min(4,Math.max(1,item.member_count));return <article className="feed-item" key={item.display_name+'-'+item.joined_at+'-'+i}><div className="feed-number">0{item.member_number}</div><div className="feed-copy"><strong>{item.display_name}</strong><span>{item.member_number===1?'just started a Four':'just joined a Four'}</span><small>{places}/4 places filled</small></div><b className="feed-pulse">●</b></article>}):<div className="feed-empty">Be the first Four on the feed.</div>}</div></section>

    <section id="how" className="section shell"><div className="eyebrow">THE CAMPAIGN LOOP</div><h2>Find. Create. Share. Watch.</h2><p className="lead">The campaign gives people something to do — and something to share — while creating a measurable path toward the cinema.</p><div className="step-grid">
      {[['01','Find','Choose the four people you want beside you.'],['02','Create','Build a personalised Four artwork from four photos.'],['03','Share','Invite your three and spread your Four.'],['04','Watch','Register, choose a cinema and complete the journey.']].map(([n,t,d])=><article className="step-card" key={n}><div className="step-no">{n}</div><h3>{t}</h3><p>{d}</p></article>)}
    </div></section>

    <section className="section shell feature"><div><div className="eyebrow">DIGITAL EXPERIENCE</div><h2>Your Four becomes the campaign.</h2><p className="lead">Capture four people, create a campaign-ready visual, share it natively and invite the other three through one unique Four link.</p><div className="mini-flow"><span>CAPTURE</span><b>→</b><span>CREATE</span><b>→</b><span>SHARE</span><b>→</b><span>WATCH</span></div><button className="btn btn-primary" onClick={()=>{setOpen(true);setStep(1)}}>Start the experience</button></div><div className="phone-card"><div className="phone"><div className="phone-label">Create Your Four</div><div className="phone-title">YOUR<br/>FOUR</div><div className="phone-faces">{[1,2,3,4].map(n=><div className="face" key={n}><span>0{n}</span></div>)}</div><button className="btn btn-primary" onClick={()=>{setOpen(true);setStep(1)}}>Generate</button></div></div></section>

    <section className="section shell"><div className="eyebrow">CAMPAIGN INTELLIGENCE</div><h2>The audience becomes measurable.</h2><p className="lead">With consent, the live platform can connect Four creation to registration, cinema selection, ticketing clicks and reward qualification.</p><div className="metrics">{['FOUR SQUADS CREATED','PEOPLE REGISTERED','CINEMA INTENT','TICKET / RSVP ACTIONS'].map(x=><div className="metric" key={x}><strong>—</strong><span>{x}</span></div>)}</div></section>

    <footer className="footer shell"><div className="eyebrow">WAWO BRAND HOUSE</div><h2>Let’s build<br/>the first Four.</h2><p>Prototype platform. Official movie artwork, talent likenesses, ticketing integrations, privacy language and reward mechanics require approval from the relevant rights holders and campaign partners.</p></footer>

    {open && <div className="modal" role="dialog" aria-modal="true"><div className="modal-card"><button className="modal-x" onClick={()=>{setOpen(false);reset()}} aria-label="Close">×</button><div className="eyebrow">FIND YOUR FOUR</div><div className="wizard-dots">{[1,2,3,4].map(n=><span key={n} className={step===n?'active':''}/>)}</div>
      {step===1&&<div className="wizard-panel"><h2>Start with your Four.</h2><p>Choose four people you want beside you. You can build it together or invite them one by one.</p><div className="modal-actions"><span/><button className="btn btn-primary" onClick={()=>setStep(2)}>Add My Four →</button></div></div>}
      {step===2&&<div className="wizard-panel"><h2>Make your Four a flyer.</h2><p>Choose a poster style inspired by the official campaign's editorial, cinematic and magazine covers — then add exactly four people.</p><div className="template-picker">{TEMPLATE_META.map(t=><button type="button" key={t.id} className={'template-card template-'+t.id+(selectedTemplate===t.id?' selected':'')} onClick={()=>setSelectedTemplate(t.id)}><div className="template-preview"><span className="tp-title">THE FOUR</span><span className="tp-four">0{t.id==='bold'?4:t.id==='sunset'?2:t.id==='magazine'?3:1}</span><div className="tp-faces">{[1,2,3,4].map(n=><i key={n}/>)}</div></div><strong>{t.name}</strong><small>{t.note}</small></button>)}</div><div className="photo-grid">{members.map((m,i)=><div className="photo-slot" key={i}><div className="slot-head"><span>0{i+1}</span><small>MEMBER 0{i+1}</small></div><button className="preview-btn" onClick={()=>fileInputs.current[i]?.click()}>{m.preview?<img src={m.preview} alt="" />:<span>ADD PHOTO</span>}</button><input ref={el=>{fileInputs.current[i]=el}} type="file" accept="image/*" hidden onChange={e=>pick(i,e.target.files?.[0]||null)}/><input className="name-input" value={m.name} placeholder="Name (optional)" onChange={e=>setName(i,e.target.value)}/></div>)}</div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button><button className="btn btn-primary" disabled={busy} onClick={generateArtwork}>{busy?'Creating…':'Create My Four'}</button></div></div>}
      {step===3&&<div className="wizard-panel artwork-panel"><h2>YOUR FOUR FLYER IS READY.</h2><div className="artwork-style-row"><div><div className="eyebrow">POSTER STYLE</div><strong>{TEMPLATE_META.find(t=>t.id===selectedTemplate)?.name}</strong></div><div className="template-switch">{TEMPLATE_META.map(t=><button type="button" key={t.id} className={selectedTemplate===t.id?'active':''} onClick={async()=>{setSelectedTemplate(t.id);setBusy(true);try{const imgs=await Promise.all(members.map(m=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=m.preview!;})));const made=await makeFourFlyer(imgs,members,code,t.id);setArtwork(made.dataUrl);setArtworkBlob(made.blob);}catch(e){setApiNote(e instanceof Error?e.message:'Could not switch poster style.');}finally{setBusy(false);}}}>{t.name}</button>)}</div></div>{artwork&&<img className="artwork" src={artwork} alt="Personalised Four campaign flyer"/>}<div className="code">FOUR CODE <strong>{code}</strong></div><p>Share the visual and invitation link with your Four. On supported phones, the native share sheet can share the image directly.</p><div className="share-actions"><button className="btn btn-primary" onClick={shareFour}>Share My Four</button><button className="btn btn-ghost" onClick={whatsapp}>WhatsApp</button><button className="btn btn-ghost" onClick={download}>Download</button>{registered && <button className="btn btn-ghost" disabled={busy || shareConfirmed} onClick={()=>void confirmMemberShare('other_self_confirmed')}>{shareConfirmed?'✓ Share Confirmed':'I Shared'}</button>}</div>{}<div className="share-status-line">{registered ? (shareConfirmed ? '✓ Your share is confirmed in the Four Room.' : 'Your friends will only unlock the creator card after all four shares are confirmed.') : 'Register below after sharing so the invitation is tied to your Four.'}</div><div className="modal-actions"><button className="btn btn-ghost" onClick={()=>setStep(2)}>Edit</button><button className="btn btn-primary" onClick={()=>setStep(4)}>Continue to Watch →</button></div></div>}
      {step===4&&<div className="wizard-panel"><h2>{isInvite?'You’ve been invited into this Four.':'Bring your Four to the cinema.'}</h2>{!registered?<><p>{isInvite?'Your Four has exactly four places. Claim the next available place and join the group.':'Register the Four captain first. In production, this becomes a consent-based campaign lead.'}</p>{isInvite && <div className="invite-members">{[1,2,3,4].map(n=>{const m=inviteMembers.find(x=>x.member_number===n);return <div className={m?'slot claimed':'slot'} key={n}><span>0{n}</span>{m?.photo_url?<img src={m.photo_url} alt="" />:<div className="room-avatar">{m?'TEXT':'OPEN'}</div>}<b>{m?.name||'OPEN'}</b>{m&&<small className={m.shared?'slot-share yes':'slot-share'}>{m.shared?'✓ SHARED':'WAITING TO SHARE'}</small>}</div>})}</div>}{isInvite && <div className="invite-photo"><div className="eyebrow">YOUR FOUR PHOTO</div><button className="preview-btn" onClick={()=>document.getElementById('invite-photo-input')?.click()}>{invitePhotoPreview?<img src={invitePhotoPreview} alt="" />:<span>ADD YOUR PHOTO</span>}</button><input id="invite-photo-input" type="file" accept="image/*" hidden onChange={e=>{const file=e.target.files?.[0]||null;if(!file)return;if(file.size>8*1024*1024){alert('Please use an image smaller than 8MB.');return;}setInvitePhoto(file);if(invitePhotoPreview)URL.revokeObjectURL(invitePhotoPreview);setInvitePhotoPreview(URL.createObjectURL(file));}}/><p className="inline-note">Your photo is saved to your Four after you claim your place.</p></div>}<div className="form-row"><input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="Your name"/><input value={regPhone} onChange={e=>setRegPhone(e.target.value)} placeholder="+234 phone"/><input value={regEmail} onChange={e=>setRegEmail(e.target.value)} placeholder="Email (optional)"/></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to receive campaign reminders and information about THE FOUR.</label><label className="consent optional-consent"><input type="checkbox" checked={publicActivityOptIn} onChange={e=>setPublicActivityOptIn(e.target.checked)}/> Show my first name and Four activity on the live campaign feed (optional).</label><button className="btn btn-primary" disabled={busy} onClick={register}>{busy?'Saving…':'Register My Four'}</button>{apiNote&&<div className="inline-note">{apiNote}</div>}</>:<><div className="success"><strong>{isInvite?'You’ve joined Four '+code+'.':'Four '+code+' is registered.'}</strong>{memberNumber&&<><br/>You are member {String(memberNumber).padStart(2,'0')}.</>}<br/>{apiNote}</div>{rewardCard&&<div className="creator-card"><div className="eyebrow">CREATOR REWARD CARD</div><div className="creator-card-inner"><div><strong>FOUR READY.</strong><span>This card belongs to the creator.</span><small>Bring this card and all three friends to the cinema/premiere claim point. Staff verifies all four before the gift is released.</small></div><div className="creator-card-code">{rewardCard.card_code}</div></div><div className="creator-card-members">{rewardCard.members.map(m=><span key={m.member_number}>0{m.member_number} {m.name||'Member'}</span>)}</div></div>}{sharedArtworkUrl&&<div className="shared-artwork"><div><div className="eyebrow">SHARED FOUR ARTWORK</div><p>The latest campaign visual is saved to the Four Room for the group.</p></div><a className="btn btn-ghost" href={sharedArtworkUrl} target="_blank" rel="noreferrer">Open Artwork ↗</a></div>}{reward?.qualified && <div className="reward-banner"><div className="eyebrow">FOUR EXPERIENCE</div><strong>Congratulations — your Four qualified.</strong><span>Reward code: {reward.reward_code}</span>{reward.rank&&<span>Place {reward.rank} of the first 500 qualifying Fours.</span>}</div>}<div className="cinema-card"><div className="eyebrow">CHOOSE YOUR CINEMA • DEMO INVENTORY</div><select value={chosenCinema} onChange={e=>{setChosenCinema(e.target.value);setChosenShowtime('')}}><option value="">Select a cinema</option>{CINEMAS.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select><input type="date" min={new Date().toISOString().slice(0,10)} value={chosenDate} onChange={e=>setChosenDate(e.target.value)}/><select value={chosenShowtime} onChange={e=>setChosenShowtime(e.target.value)} disabled={!cinema}><option value="">Select a showtime</option>{cinema?.showtimes.map(t=><option key={t}>{t}</option>)}</select><button className="btn btn-primary" disabled={busy} onClick={chooseCinema}>{busy?'Saving…':'Save My Cinema Choice'}</button><a className="btn btn-ghost" href={(typeof window!=='undefined'?window.location.pathname.replace(/\/?$/,'/'):'./')+'four/?code='+encodeURIComponent(code)}>Open Four Room ↗</a>{chosenCinema&&chosenDate&&chosenShowtime&&<div className="booking-row"><div><small>YOUR FOUR</small><strong>{chosenCinema}</strong><span>{chosenDate} • {chosenShowtime}</span></div>{ticketingUrl?<a className="btn btn-ghost" onClick={()=>void trackEvent(code,'ticket_clicked','web',{cinema:chosenCinema,showtime:chosenShowtime})} href={ticketingUrl} target="_blank" rel="noreferrer">Continue to Tickets →</a>:<button className="btn btn-ghost" onClick={()=>{void trackEvent(code,'ticket_clicked','web',{cinema:chosenCinema,showtime:chosenShowtime});alert('Ticketing partner link will be connected here in production.')}}>Continue to Tickets →</button>}</div>}</div></>}</div>}
    </div></div>}
  </main>
}
