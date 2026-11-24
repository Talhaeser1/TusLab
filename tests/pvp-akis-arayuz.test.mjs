// PvP akışı + arayüz cilası (RAPOR-PVP-AKIS-ARAYUZ.md): ana sayfadan PvP lobisi (otomatik maç yok),
// her çıkış yeni ana sayfaya, eski #app gizli, oda sunucusu yokken açık Türkçe mesaj.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PvPNetworkConsole,networkConsoleHTML,lobbyFromUrl,LOBBY_URL_FLAG,roomServerMissing,NO_ROOM_SERVER_TEXT} from '../pvp/network.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('ana sayfa: "PvP Düello" bağlantısı lobiyi açar, bot maçını otomatik başlatan ?pvp=practice adresine gitmez',()=>{
  const home=read('home/home.js');
  assert.match(home,/href="\?pvp=lobby" data-nav="pvp"/);
  assert.doesNotMatch(home,/href="\?pvp=practice[^"]*" data-nav="pvp"/);
});

test('?pvp=lobby: yalnız lobi açılır, maç başlamaz; ?mode= yalnız mod sekmesini seçer',()=>{
  assert.equal(lobbyFromUrl('http://x/?pvp=lobby'),true);
  assert.equal(lobbyFromUrl('http://x/?pvp=practice'),false);
  const saved=globalThis.location;
  globalThis.location={href:'http://x/?pvp=lobby&mode=classic'};
  const calls=[];
  const view={autoInvite:LOBBY_URL_FLAG,practiceMode:'rounds',practiceContent:'atasozu',render(){calls.push('render');},startPractice(){calls.push('practice');},join(){calls.push('join');}};
  try{PvPNetworkConsole.prototype.mount.call(view);}finally{globalThis.location=saved;}
  assert.equal(view.open,true);
  assert.equal(view.autoInvite,null);
  assert.equal(calls.includes('practice'),false);
  assert.equal(calls.includes('join'),false);
  assert.equal(view.practiceMode,'classic');
  assert.equal(view.practiceContent,'kelime');
});

test('index.js: otomatik bot maçı yalnız ?pvp=practice (test/derin bağlantı); araç çubuğu "← Ana Sayfa"',()=>{
  const src=read('pvp/pvp-main.js');
  assert.match(src,/autoPractice=new URLSearchParams\(location\.search\)\.get\('pvp'\)==='practice'/);
  assert.match(src,/data-pvp-action="close" aria-label="PvP'den çık, ana sayfaya dön">← Ana Sayfa</);
  assert.doesNotMatch(src,/Arenaya dön/);
});

test('lobi "← Ana Sayfa" PvP\'yi kapatır (lobi panelini gizleyip eski arenayı göstermez)',()=>{
  const html=networkConsoleHTML();
  const actions=html.slice(html.indexOf('<div class="sc-actions">'),html.indexOf('<div class="sc-layer">'));
  assert.match(actions,/class="lb3-close sc-close" data-pvp-action="close"/);
  assert.doesNotMatch(actions,/data-lobby-action="toggle"/);
  assert.match(html,/data-lobby-online-error role="alert" hidden/);
});

test('eski site (#app) home.js etkinken gizli: tlh-app-off sınıfı + en son yüklenen CSS kuralı',()=>{
  assert.match(read('home/home.js'),/classList\.add\('tlh-app-off'\)/);
  const css=read('pvp/compact-height.css');
  assert.match(css,/html\.tlh-app-off #app\{visibility:hidden!important;pointer-events:none!important\}/);
  // maç HUD karartması üst çubuğun üstüne binmez — RAPOR-PVP-KALANLAR madde 6: kural kaynağında (fight-hud.css), ezme kalktı
  assert.match(read('pvp/fight-hud.css'),/#pvp-root\[data-layout="fullscreen"\] \.fhud2::before\{top:var\(--fs-toolbar,40px\)\}/);
  assert.doesNotMatch(css,/\.fhud2::before\{top:/);
});

test('oda oluştur: düz sunucu (501 + HTML) → açık Türkçe mesaj, sahte oda yok, soket açılmaz',async()=>{
  assert.equal(roomServerMissing(501,'text/html'),true);
  assert.equal(roomServerMissing(404,'text/html;charset=utf-8'),true);
  assert.equal(roomServerMissing(404,'application/json'),false);
  assert.equal(roomServerMissing(404,undefined),false);
  assert.match(NO_ROOM_SERVER_TEXT,/BASLAT-CLOUDFLARE\.bat/);
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async()=>({ok:false,status:501,headers:new Headers({'content-type':'text/html;charset=utf-8'}),json:async()=>{throw new SyntaxError('html');}});
  const view={readName:()=> 'Oyuncu',disconnect:()=>calls.push('disconnect'),connect:()=>calls.push('connect'),log:m=>calls.push(m),render:()=>{}};
  try{await PvPNetworkConsole.prototype.create.call(view);}finally{globalThis.fetch=original;}
  assert.equal(calls.includes('connect'),false);
  assert.equal(view.code,undefined);
  assert.equal(view.onlineError,NO_ROOM_SERVER_TEXT);
  assert.match(view.status,/çevrimiçi sunucu yok/);
  assert.equal(view.connecting,false);
});
