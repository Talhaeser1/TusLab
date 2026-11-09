/** Phase17 social: guest friend codes, requests, blocks and friend room invites. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isCode=v=>/^[A-F0-9]{12}$/.test(String(v||''));
export const friendPanelHTML=()=>`<section class="pvp17-modal" data-pvp17-panel hidden role="region" aria-label="Arkadaşlar ve davetler">
 <header class="pvp17-heading"><div><small>⚔ RUH DÜELLOSU · ARKADAŞLAR</small><h2>Birlikte Savaşın</h2></div><button type="button" data-social-action="close" aria-label="Kapat">✕</button></header>
 <p class="pvp17-notice">Arkadaş kodunu paylaş. İstekleri yalnızca kabul edersen arkadaş olunur. Misafir kimliği bu cihazla sınırlıdır; çevrimiçi durumu gösterilmez.</p>
 <div class="pvp17-mycode"><div><small>ARKADAŞ KODUN</small><strong data-social-code>Yükleniyor…</strong></div><button type="button" data-social-action="copy">Kopyala</button></div>
 <form data-social-form class="pvp17-add"><label for="pvp17-input">Arkadaşının kodu</label><div><input id="pvp17-input" data-social-target maxlength="12" autocomplete="off" spellcheck="false" placeholder="12 karakterlik kod"/><button type="submit">İstek Gönder</button></div></form>
 <div class="pvp17-toolbar"><button type="button" data-social-action="refresh">↻ Yenile</button><span>Yeni davetler panel açıkken otomatik kontrol edilir.</span></div>
 <div data-social-content class="pvp17-content" aria-live="polite">Yükleniyor…</div>
 <p data-social-status class="pvp17-status" role="status"></p>
</section>`;
export const renderSocial=(data,roomCode='')=>{
 const row=(p,actions)=>`<div class="pvp17-person"><div><strong>${esc(p.name)}</strong><small>${esc(p.code)}</small></div><span>${actions.map(([a,label])=>`<button type="button" data-social-action="${a}" data-target="${esc(p.code)}">${label}</button>`).join('')}</span></div>`;
 const section=(name,list,actions,empty)=>`<section><h3>${name} <small>(${list.length})</small></h3>${list.length?list.map(p=>row(p,actions)).join(''):`<p class="pvp17-none">${empty}</p>`}</section>`;
 const invites=(data.invites||[]).map(i=>`<div class="pvp17-invite"><strong>${esc(i.from?.name||'Oyuncu')}</strong> seni düelloya çağırıyor <small>(${esc(i.roomCode)})</small><div><button type="button" data-social-action="join-invite" data-room="${esc(i.roomCode)}" data-invite="${esc(i.id)}">⚔ Katıl</button><button type="button" data-social-action="dismiss" data-invite="${esc(i.id)}">Kapat</button></div></div>`).join('');
 return `<section><h3>⚡ Bekleyen PvP davetleri <small>(${(data.invites||[]).length})</small></h3>${invites||'<p class="pvp17-none">Henüz yeni davet yok.</p>'}</section>
 ${section('Gelen arkadaşlık istekleri',data.incoming||[],[['accept','✓ Kabul Et'],['reject','Reddet'],['block','Engelle']],'Bekleyen istek yok.')}
 ${section('Arkadaşlar',data.friends||[],roomCode? [['invite','⚔ Odaya Çağır'],['remove','Çıkar'],['block','Engelle']] : [['remove','Çıkar'],['block','Engelle']],'Henüz arkadaş eklemedin.')}
 ${section('Gönderilen istekler',data.outgoing||[],[['cancel','İptal Et']],'Bekleyen giden istek yok.')}
 ${section('Son rakipler',data.recent||[],[['request','+ Arkadaş Ekle']],'Henüz düello yapılmamış.')}
 ${section('Engellenen oyuncular',data.blocked||[],[['unblock','Engeli Kaldır']],'Engellenen oyuncu yok.')}`;
};
export function initSocialUI(root,getGuest,getNetwork){
 let opened=false,working=false,timer=null,data=null;
 const panel=()=>root.querySelector('[data-pvp17-panel]');
 const status=value=>{const el=panel()?.querySelector('[data-social-status]');if(el)el.textContent=value;};
 const api=async (action='read',extra={})=>{
   const res=await fetch('/api/pvp/social',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guestToken:getGuest(),action,name:getNetwork().name,...extra}),cache:'no-store'});
   const out=await res.json();if(!res.ok)throw new Error(out.error||'HTTP '+res.status);return out;
 };
 const refresh=async()=>{
   if(!opened||working)return;
   working=true;
   try{
     data=await api();panel()?.querySelector('[data-social-code]')?.replaceChildren(document.createTextNode(data.code));
     const body=panel()?.querySelector('[data-social-content]');if(body)body.innerHTML=renderSocial(data,getNetwork().myId&&['waiting','countdown'].includes(getNetwork().phase)?getNetwork().code:'');
     status('Güncel · '+new Date().toLocaleTimeString('tr-TR'));
   }catch(e){status('Bağlantı hatası: '+e.message);}finally{working=false;}
 };
 const show=()=>{
   opened=true;const p=panel();if(p)p.hidden=false;
   root.dispatchEvent(new CustomEvent('tuslab:pvp-social-open'));
   if(timer!==null)clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)void refresh();},15000);
   void refresh();
 };
 const close=()=>{opened=false;const p=panel();if(p)p.hidden=true;if(timer!==null){clearInterval(timer);timer=null;}};
 root.addEventListener('click',async event=>{
   const button=event.target.closest('[data-social-action]');
   if(!button){if(event.target.closest('[data-pvp16-action="toggle"]'))close();return;}
   const action=button.dataset.socialAction;
   if(action==='toggle'){opened?close():show();return;}
   if(action==='close'){close();return;}
   if(action==='refresh'){void refresh();return;}
   if(action==='copy'){
     if(!data?.code)return;
     try{await navigator.clipboard.writeText(data.code);status('Arkadaş kodun kopyalandı.');}
     catch{status('Kopyalama izni verilmedi; kodu elle seçebilirsin.');}
     return;
   }
   if(!opened||working)return;
   const targetCode=button.dataset.target;
   if(action==='join-invite'){
     const code=button.dataset.room;
     if(!/^[A-Z2-9]{16}$/.test(code||''))return status('Geçersiz oda kodu.');
     try{await api('dismiss',{inviteId:button.dataset.invite});}catch{}
     close();const net=getNetwork();net.open=true;net.render();void net.join(code);return;
   }
   if(!['request','accept','reject','remove','block','unblock','cancel','invite','dismiss'].includes(action))return;
   if(action!=='dismiss'&&!isCode(targetCode))return status('Geçersiz arkadaş kodu.');
   if(['remove','block'].includes(action)&&!window.confirm(action==='block'?'Bu oyuncuyu engellemek istiyor musun?':'Arkadaşlıktan çıkarmak istiyor musun?'))return;
   const roomCode=action==='invite'?getNetwork().code:null;
   working=true;
   try{data=await api(action,{targetCode,roomCode,inviteId:button.dataset.invite});status('İşlem tamamlandı.');}
   catch(e){status('İşlem yapılamadı: '+e.message);}finally{working=false;}
   void refresh();
 });
 root.addEventListener('submit',async e=>{
   if(!e.target.matches('[data-social-form]'))return;
   e.preventDefault();if(working)return;
   const code=panel()?.querySelector('[data-social-target]')?.value?.trim()?.toUpperCase();
   if(!isCode(code))return status('12 karakterli arkadaş kodu gir.');
   working=true;
   try{await api('request',{targetCode:code});status('Arkadaşlık isteği gönderildi.');panel().querySelector('[data-social-target]').value='';}
   catch(err){status('İstek gönderilemedi: '+err.message);}finally{working=false;}
   void refresh();
 });
 return {refresh,close};
}
