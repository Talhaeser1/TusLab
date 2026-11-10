/** Read-only Phase16 guest history and public rankings. All stats from server. */
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number(v||0).toLocaleString('tr-TR');
/* Boş/hata durumu: ne olacağını söyleyen başlık + tek cümle + fiille başlayan eylem (paket 32 menü denetimi). */
const emptyState=(title,text,action,label)=>`<div class="pvp16-empty"><strong>${title}</strong><p>${text}</p>${action?`<button type="button" class="pvp16-cta" data-pvp16-action="${action}">${label}</button>`:''}</div>`;
export function profilePanelHTML(){return `<section class="pvp16-modal" data-pvp16-panel hidden aria-labelledby="pvp16-title" role="region" tabindex="-1">
  <div class="pvp16-head"><div><small>⚔ RUH DÜELLOSU · MİSAFİR PROFİLİ</small><h2 id="pvp16-title">🏆 Oyuncular ve Sıralama</h2></div><button type="button" class="pvp16-close" data-pvp16-action="close" aria-label="Profil panelini kapat (Esc)">✕</button></div>
  <p class="pvp16-note">Misafir kimliğin yalnız bu tarayıcıda saklanır. Arkadaş odaları <b>derecesizdir</b>; derecelendirme puanı değişmez.</p>
  <div class="pvp16-tabs" role="group" aria-label="Görünüm"><button type="button" data-pvp16-action="view-profile" aria-pressed="true">Profilimi göster</button><button type="button" data-pvp16-action="view-board" aria-pressed="false">Sıralamayı göster</button><button type="button" data-pvp16-action="refresh">↻ Yenile</button></div>
  <div class="pvp16-filters" data-pvp16-filters hidden><label>Ölçüt <select data-pvp16-metric><option value="wins">Galibiyet</option><option value="wpm">Ortalama WPM</option><option value="accuracy">Doğruluk</option><option value="rating">Dereceli puan</option></select></label><label>Dönem <select data-pvp16-range><option value="all">Tüm zamanlar</option><option value="week">Bu hafta (UTC)</option></select></label></div>
  <div class="pvp16-body" data-pvp16-body aria-live="polite">Veriler yükleniyor…</div>
  <p class="pvp16-status" data-pvp16-status role="status"></p>
</section>`;}
export function profileView(profile){
  if(!profile)return emptyState('Henüz düello kaydın yok','Bir arkadaşınla oda kurup ilk maçını bitirdiğinde galibiyet, WPM ve maç geçmişin burada görünür.','open-lobby','⚔ Lobiyi aç');
  const nums=[['Galibiyet',profile.wins],['Mağlubiyet',profile.losses],['Beraberlik',profile.draws],['Ortalama WPM',profile.avgWpm],['Doğruluk','%'+number(profile.avgAccuracy)],['En yüksek kombo',profile.highestCombo],['Toplam hasar',profile.totalDamage],['Dereceli puan',profile.rating]];
  const cards=nums.map(([label,val])=>`<div class="pvp16-stat"><strong>${typeof val==='number'?number(val):escape(val)}</strong><small>${label}</small></div>`).join('');
  const history=(profile.history||[]).map(r=>`<div class="pvp16-match"><strong class="pvp16-${escape(r.outcome)}">${({win:'ZAFER',loss:'YENİLGİ',draw:'BERABERE',cancelled:'İPTAL'})[r.outcome]||'MAÇ'}</strong><span>${escape(r.opponent)}</span><small>${number(r.wpm)} WPM · %${number(r.accuracy)} · ${new Date(r.endedAt).toLocaleDateString('tr-TR')}</small></div>`).join('');
  return `<h3>${escape(profile.name)} <small>· Misafir Oyuncu</small></h3><div class="pvp16-statgrid">${cards}</div><p class="pvp16-note">${number(profile.matches)} tamamlanan maç · ${number(profile.rankedGames)} dereceli maç · ${number(profile.cancelled)} iptal</p><h3>Son 20 düello</h3>${history||emptyState('Maç geçmişi boş','Tamamlanan her düello sonucu ve rakibinle birlikte buraya eklenir.','open-lobby','⚔ Lobiyi aç')}`;
}
export function boardView(entries,metric){
  if(!entries.length)return emptyState('Bu filtrede sıralama yok','Başka bir ölçüt ya da dönem seç; dereceli puan listesi dereceli eşleştirme açılınca dolacak.','reset-filters','Filtreleri sıfırla');
  const value=p=>metric==='wpm'?number(p.avgWpm)+' WPM':metric==='accuracy'?'%'+number(p.avgAccuracy):metric==='rating'?number(p.rating)+' RP':number(p.wins)+' galibiyet';
  return `<div class="pvp16-board">${entries.map(p=>`<div class="pvp16-row"><strong>#${number(p.rank)}</strong><span>${escape(p.name)}</span><em>${escape(value(p))}</em><small>${number(p.matches)} maç</small></div>`).join('')}</div>`;
}
export function initProfileUI(root,getGuest){
  let view='profile',isOpen=false,serial=0;
  const el=()=>root.querySelector('[data-pvp16-panel]');
  const opener=()=>root.querySelector('[data-pvp16-action="toggle"]');
  const setState=message=>{const n=el()?.querySelector('[data-pvp16-status]');if(n)n.textContent=message;};
  const setOpen=(next,{focus=true}={})=>{
    isOpen=next;const p=el();if(p)p.hidden=!isOpen;
    opener()?.setAttribute('aria-expanded',String(isOpen));
    if(!focus)return;
    // Açılınca odak panele, kapanınca açan düğmeye döner (klavye kullanıcısı yerini kaybetmez).
    if(isOpen)p?.querySelector('[data-pvp16-action="close"]')?.focus({preventScroll:true});
    else opener()?.focus({preventScroll:true});
  };
  const refresh=async()=>{
    const panel=el();if(!panel||!isOpen)return;
    const body=panel.querySelector('[data-pvp16-body]');body.textContent='Sunucudan yükleniyor…';
    const id=++serial;
    try{
      let data,res;
      if(view==='profile'){
        res=await fetch('/api/pvp/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guestToken:getGuest()}),cache:'no-store'});
        data=await res.json();if(!res.ok)throw Error(data.error||'HTTP '+res.status);
        if(id===serial)body.innerHTML=profileView(data.profile);
      }else{
        const metric=panel.querySelector('[data-pvp16-metric]').value,range=panel.querySelector('[data-pvp16-range]').value;
        res=await fetch('/api/pvp/leaderboard?'+new URLSearchParams({metric,range}),{cache:'no-store'});
        data=await res.json();if(!res.ok)throw Error(data.error||'HTTP '+res.status);
        if(id===serial)body.innerHTML=boardView(data.entries||[],metric);
      }
      if(id===serial)setState('Sunucudan güncellendi.');
    }catch(error){
      if(id===serial){
        // Teknik hata metni (ör. "Unexpected token '<'") oyuncuya gösterilmez; konsola yazılır.
        console.warn('[pvp16] profil yüklenemedi:',error);
        body.innerHTML=emptyState('Profil sunucusuna ulaşılamadı','Bağlantın ya da sunucu geçici olarak yanıt vermiyor. Maçların kaybolmaz; birazdan yeniden dene.','refresh','↻ Yeniden dene');
        setState('');
      }
    }
  };
  root.addEventListener('tuslab:pvp-social-open',()=>{if(isOpen)setOpen(false,{focus:false});});
  // Yakalama aşamasında ve PvP'nin kendi Esc dinleyicisinden (index.js, PvP'den çıkar) önce kaydedilir:
  // panel açıkken Esc yalnız paneli kapatır, oyuncuyu maçtan/PvP'den çıkarmaz.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!isOpen||el()?.hidden!==false)return;
    event.preventDefault();event.stopImmediatePropagation();setOpen(false);
  },true);
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-pvp16-action]');if(!button)return;
    const action=button.dataset.pvp16Action;
    if(action==='close'||action==='toggle'){setOpen(action==='toggle'?!isOpen:false);if(isOpen)void refresh();return;}
    if(action==='refresh'){void refresh();return;}
    if(action==='open-lobby'){
      setOpen(false,{focus:false});
      const lobby=root.querySelector('[data-lobby-action="toggle"]');
      if(lobby&&lobby.getAttribute('aria-expanded')!=='true')lobby.click();
      lobby?.focus({preventScroll:true});
      return;
    }
    if(action==='reset-filters'){
      const panel=el();if(!panel)return;
      panel.querySelector('[data-pvp16-metric]').value='wins';panel.querySelector('[data-pvp16-range]').value='all';
      void refresh();return;
    }
    if(action.startsWith('view-')){
      view=action==='view-board'?'board':'profile';
      const panel=el();if(!panel)return;
      panel.querySelector('[data-pvp16-filters]').hidden=view!=='board';
      panel.querySelectorAll('[data-pvp16-action^="view-"]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      void refresh();
    }
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-pvp16-metric],[data-pvp16-range]'))void refresh();});
  return {refresh};
}
