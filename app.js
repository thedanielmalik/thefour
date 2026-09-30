(() => {
  const state = { files:[null,null,null,null], names:['','','',''], code:null, artworkBlob:null };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const makeCode=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let o='F4-';for(let i=0;i<6;i++)o+=c[Math.floor(Math.random()*c.length)];return o};
  const openModal=()=>{$('#createModal')?.classList.add('is-open');document.body.classList.add('modal-open')};
  const closeModal=()=>{$('#createModal')?.classList.remove('is-open');document.body.classList.remove('modal-open')};
  const showStep=n=>{$$('.wizard-step').forEach(e=>e.classList.toggle('active',Number(e.dataset.step)===n));$$('.wizard-dot').forEach(e=>e.classList.toggle('active',Number(e.dataset.dot)===n))};
  function setupSlots(){
    $$('.photo-slot').forEach(slot=>{
      const i=Number(slot.dataset.index), input=$('input[type=file]',slot), nameInput=$('input[type=text]',slot), preview=$('.slot-preview',slot);
      input?.addEventListener('change',()=>{
        const f=input.files?.[0]; if(!f)return;
        if(!f.type.startsWith('image/')){alert('Please choose an image file.');input.value='';return}
        state.files[i]=f; preview.innerHTML=''; const img=new Image(); img.alt='Four member preview'; img.onload=()=>preview.appendChild(img); img.src=URL.createObjectURL(f); slot.classList.add('has-image');
      });
      nameInput?.addEventListener('input',()=>state.names[i]=nameInput.value.trim());
    });
  }
  const loadImage=file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=URL.createObjectURL(file)});
  function coverCrop(ctx,img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h)}
  async function createArtwork(){
    if(state.files.some(f=>!f)){alert('Add all four photos before creating your Four.');return}
    if(!state.code)state.code=makeCode();
    const c=document.createElement('canvas');c.width=1080;c.height=1350;const ctx=c.getContext('2d');
    ctx.fillStyle='#f4efe5';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle='#173b4d';ctx.font='700 50px Georgia,serif';ctx.textAlign='center';ctx.fillText('THE FOUR',540,70);
    ctx.fillStyle='#6f1d2b';ctx.font='700 20px Arial,sans-serif';ctx.fillText('NO ONE FIGHTS ALONE',540,105);
    const margin=46,gap=16,tileW=(1080-margin*2-gap)/2,tileH=480,top=145,imgs=await Promise.all(state.files.map(loadImage));
    for(let i=0;i<4;i++){
      const x=margin+(i%2)*(tileW+gap),y=top+Math.floor(i/2)*(tileH+gap);ctx.save();ctx.beginPath();ctx.roundRect(x,y,tileW,tileH,24);ctx.clip();coverCrop(ctx,imgs[i],x,y,tileW,tileH);ctx.restore();
      ctx.strokeStyle='#6f1d2b';ctx.lineWidth=4;ctx.strokeRect(x,y,tileW,tileH);ctx.fillStyle='rgba(20,20,20,.72)';ctx.fillRect(x,y+tileH-60,tileW,60);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='700 17px Arial,sans-serif';ctx.fillText((state.names[i]||('MEMBER '+String(i+1).padStart(2,'0'))).toUpperCase(),x+16,y+tileH-23);
    }
    ctx.textAlign='center';ctx.fillStyle='#6f1d2b';ctx.font='700 36px Georgia,serif';ctx.fillText('WHO ARE YOUR FOUR?',540,1205);
    ctx.fillStyle='#173b4d';ctx.font='700 18px Arial,sans-serif';ctx.fillText('FIND YOUR FOUR  •  BRING YOUR FOUR  •  WATCH THE FOUR',540,1245);
    ctx.fillStyle='#665a54';ctx.font='15px Arial,sans-serif';ctx.fillText('FOUR CODE: '+state.code,540,1284);
    return new Promise(resolve=>c.toBlob(blob=>resolve({blob,url:c.toDataURL('image/jpeg',.94)}),'image/jpeg',.94));
  }
  async function renderArtwork(){const result=await createArtwork();if(!result)return;state.artworkBlob=result.blob;$('#artworkImage').src=result.url;$('#artworkCode').textContent=state.code;showStep(3)}
  function invite(){const code=state.code|| (state.code=makeCode()),u=new URL(location.href);u.searchParams.set('four',code);return{url:u.toString(),text:'I found my Four. ❤️ You are one of mine. Join our Four for THE FOUR: '+u.toString()}};
  async function shareFour(){const x=invite();try{if(navigator.share){if(state.artworkBlob&&navigator.canShare){const file=new File([state.artworkBlob],`my-four-${state.code}.jpg`,{type:'image/jpeg'});if(navigator.canShare({files:[file]})){await navigator.share({title:'My Four',text:x.text,files:[file]});return}}await navigator.share({title:'My Four',text:x.text,url:x.url});return}}catch(_){}try{await navigator.clipboard.writeText(x.text)}catch(_){}alert('Your Four invite has been copied.')}
  const shareWhatsApp=()=>{const x=invite();window.open('https://wa.me/?text='+encodeURIComponent(x.text),'_blank','noopener,noreferrer')};
  const downloadArtwork=()=>{if(!state.artworkBlob)return;const a=document.createElement('a');a.href=URL.createObjectURL(state.artworkBlob);a.download='my-four-'+(state.code||'F4')+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  function bind(){
    $$('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
    $('#openCreator')?.addEventListener('click',openModal);$('#closeModal')?.addEventListener('click',closeModal);$('#backdrop')?.addEventListener('click',closeModal);
    $('#nextToPhotos')?.addEventListener('click',()=>showStep(2));$('#backToIntro')?.addEventListener('click',()=>showStep(1));$('#generateFour')?.addEventListener('click',renderArtwork);
    $('#backToPhotos')?.addEventListener('click',()=>showStep(2));$('#shareFour')?.addEventListener('click',shareFour);$('#shareWhatsApp')?.addEventListener('click',shareWhatsApp);$('#downloadFour')?.addEventListener('click',downloadArtwork);$('#closeAfterDone')?.addEventListener('click',closeModal);
    $('#registerFour')?.addEventListener('click',()=>{
      const n=$('#regName')?.value.trim(),p=$('#regPhone')?.value.trim();if(!n||!p){alert('Enter your name and phone number to continue.');return}
      localStorage.setItem('four_'+state.code,JSON.stringify({name:n,phone:p,createdAt:new Date().toISOString()}));const m=$('#registerMessage');m.textContent='You’re registered, '+n+'. Your Four code is '+state.code+'.';m.classList.add('show');
    });
    $('#copyCode')?.addEventListener('click',async()=>{const x=invite();try{await navigator.clipboard.writeText(x.url)}catch(_){}alert('Your Four link has been copied.')});
    $$('.modal-close-on-backdrop').forEach(e=>e.addEventListener('click',ev=>{if(ev.target===e)closeModal()}));
  }
  function handleInvite(){const code=new URLSearchParams(location.search).get('four');if(!code)return;state.code=code;$('#inviteCode').textContent=code;$('#inviteBanner')?.classList.add('show');}
  document.addEventListener('DOMContentLoaded',()=>{setupSlots();bind();handleInvite()});
})();