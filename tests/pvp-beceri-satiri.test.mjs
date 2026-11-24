// RAPOR-BECERI-SATIRI §1 — E (savunma) gerçekten işliyor mu? Tohumlu raund maçı, iki koltuk da seri 7'ye çıkar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,advanceMatch,nextDeadline,publicMatch,ROUND_HP} from '../pvp/shared/match.js';
import {readSkillState,skillMeter,skillStatusText} from '../pvp/skillbar.js';

const T0=10_000;
const make=(f1,f2)=>createMatch([{playerId:'a',seat:1,character:'fire',fighter:f1,rune:'none',name:'A'},{playerId:'b',seat:2,character:'rune',fighter:f2,rune:'none',name:'B'}],
  T0,'bs',{rounds:7,seed:'bs',roundStyle:'timed',resolveAtEnd:true});
const seat=(m,s)=>m.participants.find(p=>p.seat===s);
function type(m,s,at){const p=seat(m,s);const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:m.round.words[p.roundWordIndex],round:m.round.index},at);assert.ok(out.match,out.error);return out;}
function finishRound(m){const idx=m.round.index;const events=[];
  for(let k=0;k<2000&&m.status==='running'&&m.round.index===idx;k++){const at=Math.max(nextDeadline(m)??m.round.endsAt,m.round.endsAt);const st=advanceMatch(m,at+1,()=>0.99);m=st.match;events.push(...st.events);}
  return {m,events};}

test('Vargr vs Nyx (ikisi de can): tam canda seri 7 → E bekletilir (BEKLİYOR), çözümde darbeden sonra uygulanır ve olay gelir',()=>{
  let m=make('vargr','nyx');const casts=[];
  for(let i=1;i<=7;i++){for(const s of [1,2]){const out=type(m,s,T0+i*400+s*10);m=out.match;if(out.result.cast?.type==='HEAL_APPLIED')casts.push(out.result.cast);}}
  assert.equal(casts.length,2,'iki koltukta da E atıldı');
  for(const c of casts){assert.equal(c.amount,0);assert.equal(c.banked,300);}
  // HUD görüntüsü: E kartı BEKLİYOR (publicMatch healBank'ı taşır)
  const pub=publicMatch(m,1);
  for(const p of pub.players){assert.equal(p.healBank,300);const e=readSkillState(p,'E',{rounds:true,now:0});assert.equal(skillMeter(e).state,'pending');assert.equal(skillStatusText(e),'BEKLİYOR');}
  const {m:after,events}=finishRound(m);
  const heals=events.filter(e=>e.type==='HEAL_APPLIED');
  for(const s of [1,2]){
    const taken=events.filter(e=>e.type==='DAMAGE_APPLIED'&&e.toSeat===s).reduce((a,e)=>a+e.amount,0);
    const healed=heals.filter(e=>e.seat===s).reduce((a,e)=>a+e.amount,0);
    assert.ok(taken>0,`koltuk ${s} hasar yedi`);
    assert.equal(healed,Math.min(300,taken),`koltuk ${s}: bekleyen can yenen hasar kadar geri geldi`);
    assert.equal(seat(after,s).hp,ROUND_HP-taken+healed);
    // her bekletilen can olayı darbeden SONRA gelir ve darbe öncesi/sonrası değerleri taşır (HUD önce düşüş sonra yükseliş çizer)
    for(const h of heals.filter(e=>e.seat===s)){assert.equal(h.banked,true);const i=events.indexOf(h);assert.equal(events[i-1].type,'DAMAGE_APPLIED');assert.equal(events[i-1].hpAfter,h.hpAfter-h.amount);}
  }
});

test('kalkan (Sira): seri 7 → KALKAN 330, çözümde hasarı emer (DAMAGE_APPLIED.absorbed)',()=>{
  let m=make('sira','nyx');
  for(let i=1;i<=7;i++)m=type(m,1,T0+i*400).match;
  const e=readSkillState(publicMatch(m,1).players[0],'E',{rounds:true,now:0});
  assert.equal(skillStatusText(e),'KALKAN 330');
  for(let i=1;i<=5;i++)m=type(m,2,T0+i*400+50).match; // rakip Q + W
  const {m:after,events}=finishRound(m);
  const hits=events.filter(x=>x.type==='DAMAGE_APPLIED'&&x.toSeat===1);
  const absorbed=hits.reduce((a,x)=>a+(x.absorbed||0),0);
  assert.ok(absorbed>0,'kalkan hasar emdi');
  assert.equal(seat(after,1).hp,ROUND_HP-hits.reduce((a,x)=>a+x.amount,0));
});

test('mevcut kural (değiştirilmedi): o raund hiç darbe yenmezse bekleyen can raund sonunda düşer',()=>{
  let m=make('vargr','nyx');
  for(let i=1;i<=7;i++)m=type(m,1,T0+i*400).match;
  const {m:after}=finishRound(m);
  assert.equal(seat(after,1).hp,ROUND_HP);assert.equal(seat(after,1).healBank,0);
});
