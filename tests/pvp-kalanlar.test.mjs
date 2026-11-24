// RAPOR-PVP-KALANLAR (23 Kas 2026): PvP kalan işleri — raund beceri satırı Q/W/E/R, kalkan görseli, denge, ulti kuralı metni,
// telefonda arena kartları, fhud2 karartması kaynağında, "Lobiye dön", Rastgele içerik.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as engine from '../pvp/shared/match.js';
import * as server from '../cloudflare/src/match.js';
import {syncRowLayout,rowKeysFor,ROW_KEYS,applyFighterNames,skillCardHTML} from '../pvp/skillbar.js';
import {pickBotTimeSkill,BOT_PERSONAS,BOT_PLANS} from '../pvp/shared/bot-ai.js';
import {HOWTO_TABS,ULTI_RULE_TEXT} from '../pvp/howto.js';
import {leaveLabel} from '../pvp/phase15-results.js';
import {contentMixPlan,isContentId,normalizeContent,CONTENT_LABELS,MIX_CONTENTS} from '../pvp/shared/content-modes.js';
import {ttModeLabel} from '../pvp/typing-top-model.js';
import {roundContentTag} from '../pvp/rounds-ui.js';
import {CONTENT_OPTIONS} from '../pvp/arena-ui.js';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const {createMatch,submitWord,publicMatch,roundStartPayload}=engine;
const T0=10_000;

// --- 1) raund modunda beceri satırı Q/W/E/R ---
function fakeRow(keys){
  const cards=Object.fromEntries(keys.map(k=>[k,{hidden:false,dataset:{skKind:'fire'},q:{}}]));
  for(const c of Object.values(cards)){c.strong={textContent:''};c.fx={textContent:''};c.badge={textContent:''};c.icon={innerHTML:''};
    c.querySelector=s=>s==='.sk-copy strong'?c.strong:s==='.sk-fx'?c.fx:s==='.sk-key'?c.badge:s==='.sk-icon'?c.icon:null;}
  return {dataset:{},cards,querySelector:s=>{const m=/data-skill="(\w)"/.exec(s);return m?cards[m[1]]||null:null;}};
}
test('madde 1: rounds satırı Q/W/E/R (S gizli), klasik Q/E/S/R (W gizli); adlar motor anahtarından',()=>{
  assert.deepEqual([...ROW_KEYS.rounds],['Q','W','E','R']);assert.deepEqual([...rowKeysFor(false)],['Q','E','S','R']);
  const row=fakeRow(['Q','W','E','S','R']);
  syncRowLayout(row,{rounds:true});
  assert.deepEqual(Object.entries(row.cards).filter(([,c])=>c.hidden).map(([k])=>k),['S']);
  applyFighterNames(row,'doran',{rounds:true});
  assert.equal(row.cards.W.strong.textContent,'Kalkan Ezici');assert.equal(row.cards.E.strong.textContent,'Sur Andı');assert.equal(row.cards.W.badge.textContent,'W');
  syncRowLayout(row,{rounds:false});
  assert.deepEqual(Object.entries(row.cards).filter(([,c])=>c.hidden).map(([k])=>k),['W']);
  applyFighterNames(row,'doran',{rounds:false});
  assert.equal(row.cards.E.strong.textContent,'Kalkan Ezici');assert.equal(row.cards.E.badge.textContent,'W','klasikte E kartı yakın vuruş (W rozeti)');
  // index.js ilk işaretlemede beş kart: W gizli başlar; CSS gizli kartı yer kaplatmaz.
  const idx=read('pvp/pvp-main.js');
  assert.match(idx,/\$\{ability\(p\.id,'W',[^)]*,5\)\.replace\('<button ','<button hidden '\)\}/);
  assert.match(read('pvp/skillbar.css'),/\.pvp2-skillrow>\.sk-card\[hidden\]\{display:none!important\}/);
  assert.match(skillCardHTML('fire','W','Yer Yaran Darbe',5),/data-skill="W"/);
});

// --- 2) kalkan görseli ---
test('madde 2: HEAL_APPLIED kind:shield → camgöbeği kubbe + halkalar; kırılma SHIELD_BROKEN; azaltılmış harekette sessiz',()=>{
  const fx=read('pvp/arena3d-fx.js'),a3=read('pvp/arena3d.js'),idx=read('pvp/pvp-main.js');
  assert.match(fx,/case 'HEAL_APPLIED':[^]*?if \(event\.kind === 'shield'\) shieldRaise\(event\);\s*else if/);
  assert.match(fx,/function shieldRaise\(ev\)[^]*?PAL\.shield\.ring[^]*?countScale\(\)/,'havuz + perf kademesi');
  assert.ok(fx.indexOf("if (reduced()) { reducedFlash(event); return; }")<fx.indexOf("case 'HEAL_APPLIED':"),'reduced: switch öncesi döner');
  assert.match(a3,/export const E_SHIELD_COLOR = 0x5ee3f5;/);
  assert.match(a3,/if \(event\.kind === 'shield'\) raiseEShield\(seat\);/);
  assert.match(a3,/function shatterBubble\(seat\) \{[^}]*fighter\.eShield = null;/);
  assert.match(idx,/action\.type==='HEAL_APPLIED'&&action\.kind==='shield'\)\{[^}]*onDefense\('BLOCK'\)/,'2B yedek');
});

// --- 3) denge ---
test('madde 3: kalkan 330 (can 300), raund başına en çok 2 destek, zincir 13 sonra her 8; sunucu aynı sabitleri yeniden ihraç eder',()=>{
  assert.equal(engine.SHIELD_AMOUNT,330);assert.equal(engine.DEFENSE_AMOUNT,300);assert.equal(engine.healAmount('shield'),330);assert.equal(engine.healAmount(),300);
  assert.equal(engine.ROUND_ASSIST_CAP,2);assert.equal(engine.CHAIN_LONG_AFTER,13);assert.equal(engine.CHAIN_EVERY_LONG,8);
  assert.deepEqual([11,12,13,14,20,21,29].map(s=>engine.chainProgress(s)),[{pos:1,every:3},{pos:2,every:3},{pos:0,every:3},{pos:1,every:8},{pos:7,every:8},{pos:0,every:8},{pos:0,every:8}]);
  for(const k of ['SHIELD_AMOUNT','ROUND_ASSIST_CAP','CHAIN_LONG_AFTER','CHAIN_EVERY_LONG','chainProgress'])assert.equal(server[k],engine[k],k);
});
test('madde 3: raund modunda üçüncü destek aynı raundda çıkmaz (bar dolu bekler)',()=>{
  let m=createMatch([{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}],T0,'as',{rounds:7,roundStyle:'timed',seed:'as',resolveAtEnd:true,assist:true});
  let assists=0;
  for(let i=0;i<60&&m.round.phase==='round';i++){
    const p=m.participants[0];const w=m.round.words[p.roundWordIndex];
    const out=submitWord(m,{playerId:'a',matchId:m.id,wordIndex:p.wordIndex,text:w,round:m.round.index},T0+300+i*7000/10);
    if(!out.match)break;m=out.match;if(out.result.assistCast||m.pendingAttacks.some(a=>a.assist&&a.roundWordIndex===p.roundWordIndex))assists=m.pendingAttacks.filter(a=>a.assist).length;
  }
  assert.ok(m.participants[0].roundAssists<=engine.ROUND_ASSIST_CAP);
  const n=m.pendingAttacks.filter(a=>a.assist).length;
  assert.equal(n,engine.ROUND_ASSIST_CAP,`destek ${n} (tavansız 3+ olurdu)`);assert.equal(m.participants[0].assist.meter,100,'bar dolu bekler');
});
test('madde 3: bot süre becerisi — her kişilik önce Zaman Hırsızı, sonra Donmuş An; plan çarpanları küçük',()=>{
  const ctx={rounds:true,hp:3000,maxHp:6000,foeHp:3000,foeMaxHp:6000,streak:0,foeStreak:0,timeLeft:1};
  for(const id of Object.keys(BOT_PERSONAS)){
    assert.equal(pickBotTimeSkill(ctx,BOT_PERSONAS[id],()=>0.3,{available:['timethief','freeze','blindclock'],chance:1}),'timethief',id);
    assert.equal(pickBotTimeSkill(ctx,BOT_PERSONAS[id],()=>0.3,{available:['freeze','blindclock'],chance:1}),'freeze',id);
  }
  assert.deepEqual({...BOT_PLANS.push},{wpm:1.01,typo:1.2});assert.deepEqual({...BOT_PLANS.careful},{wpm:0.99,typo:0.8});
});

// --- 4) ulti kuralı görünür ---
test('madde 4: "Ulti çarpanı en çok ×2" nasıl oynanır panelinde ve R kartı açıklamasında',()=>{
  assert.equal(ULTI_RULE_TEXT,'Ulti çarpanı en çok ×2');
  const text=JSON.stringify(HOWTO_TABS);
  assert.ok(text.includes('Ulti çarpanı en çok ×2'));assert.ok(text.includes('7 raund, raund 30 sn, 6000 can'));
  assert.match(skillCardHTML('fire','R','Kızıl Fırtına',10),/aria-label="R Kızıl Fırtına: 10 doğru kelimede kendiliğinden çıkar\. Ulti çarpanı en çok ×2"/);
  assert.equal(engine.ULTIMATE_PHASES.fire.length,3,'R hâlâ 3 evre');
});

// --- 5) telefon arena kartları ---
test('madde 5: telefonda arena seçimi kartlar (2×2 + Rastgele), kısa ekranda tek sıra; ok satırı gizli',()=>{
  const css=read('pvp/compact-height.css');
  const block=css.slice(css.indexOf('/* --- 5) ARENA seçimi telefonda'));
  assert.match(block,/@media \(max-width:760px\),\(max-width:1000px\) and \(max-aspect-ratio:1\/1\)\{[^]*?\.j2-arena \.sc-arena-row\{display:none\}/);
  assert.match(block,/\.lb3-stage-strip\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(block,/max-height:700px[^]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\) 26px/);
  assert.doesNotMatch(block,/font-size:(?:[0-9]|1[01])px/,'12 px altı yazı yok');
});

// --- 6) fhud2 karartması kaynağında ---
test('madde 6: .fhud2::before üst kenarı fight-hud.css içinde, compact-height.css ezmesi yok',()=>{
  assert.match(read('pvp/fight-hud.css'),/#pvp-root\[data-layout="fullscreen"\] \.fhud2::before\{top:var\(--fs-toolbar,40px\)\}/);
  assert.doesNotMatch(read('pvp/compact-height.css'),/\.fhud2::before\{/);
});

// --- 7) sonuç ekranı ---
test('madde 7: bot maçında çıkış düğmesi "Lobiye dön", odada "Odadan çık"; aynı leave yolu',()=>{
  assert.equal(leaveLabel(true),'Lobiye dön');assert.equal(leaveLabel(false),'Odadan çık');
  const src=read('pvp/phase15-results.js');
  assert.match(src,/const leave=overlay\.querySelector\('\[data-pvp15-action="leave"\]'\);\s*if\(leave\)\{const label=leaveLabel\(vsBot\)/);
  assert.match(read('pvp/pvp-main.js'),/control\.dataset\.pvp15Action==='leave'\)\{\s*network\.disconnect\(true\);/);
});

// --- 8) Rastgele içerik ---
test('madde 8: Rastgele içerik — tohumlu raund planı, her 4 raundda dört içerik, art arda aynısı yok; iki koltuk aynı içeriği görür',()=>{
  assert.ok(isContentId('rastgele'));assert.equal(normalizeContent('rastgele'),'rastgele');assert.equal(CONTENT_LABELS.rastgele,'Rastgele');
  assert.ok(CONTENT_OPTIONS.some(o=>o.id==='rastgele'));
  for(const seed of ['a','b','c',42]){
    const plan=contentMixPlan(seed,10);
    assert.deepEqual(plan,contentMixPlan(seed,10),'deterministik');
    assert.deepEqual([...plan.slice(0,4)].sort(),[...MIX_CONTENTS].sort());assert.deepEqual([...plan.slice(4,8)].sort(),[...MIX_CONTENTS].sort());
    for(let i=1;i<plan.length;i++)assert.notEqual(plan[i],plan[i-1]);
  }
  const m=createMatch([{playerId:'a',seat:1,character:'fire'},{playerId:'b',seat:2,character:'rune'}],T0,'mx',{rounds:7,roundStyle:'counted',content:'rastgele',seed:'mx',resolveAtEnd:true});
  const first=m.contentMix[0];
  const p1=publicMatch(m,1),p2=publicMatch(m,2);
  assert.equal(p1.content,'rastgele');assert.equal(p1.round.content,first);assert.equal(p2.round.content,first);
  assert.deepEqual(p1.round.words,p2.round.words);
  assert.equal(roundStartPayload(m).roundContent,first);
  assert.equal(Array.isArray(p1.round.hints),first==='siir'||first==='osmanlica');
  assert.match(ttModeLabel(p1),new RegExp(`^RASTGELE · ${({kelime:'KELİME',atasozu:'ATASÖZÜ',siir:'ŞİİR',osmanlica:'OSMANLICA'})[first]} · RAUND 1/7`));
  assert.equal(roundContentTag({content:'siir'}),' · ŞİİR');assert.equal(roundContentTag({}),'');
  // Sunucu doğrulaması: bilinmeyen içerik kimliği reddedilir (room.js isContentId).
  assert.match(read('cloudflare/src/room.js'),/if\(payload\.content!==undefined&&!isContentId\(payload\.content\)\)return safeSend\(ws,'ERROR',\{code:'INVALID_MATCH_CONFIG'\}\);/);
  assert.equal(isContentId('karisik'),false);
});
test('madde 8: içerik düzeltmeleri — yinelenen atasözü parçası yok, Nedim dizesi "Sitanbul"',async()=>{
  const {ATASOZLERI}=await import('../pvp/shared/content-atasozu.js');
  const {SIIR_DIZELERI}=await import('../pvp/shared/content-siir.js');
  assert.ok(!ATASOZLERI.includes('Deveye hendek atlatmak zordur.'));
  assert.ok(SIIR_DIZELERI.some(d=>d.metin.startsWith('Bu şehri Sitanbul')));
  assert.ok(!SIIR_DIZELERI.some(d=>/Sıtanbul/.test(d.metin)));
});
