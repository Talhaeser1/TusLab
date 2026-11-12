import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,submitWord,streakMultiplier,wrongStreak} from '../pvp/shared/match.js';

// KESINYAP 13: rounds'ta yanlış kelime seriyi yarıya indirir (aşağı yuvarlanır).
const T0=10_000;
const make=()=>createMatch([{playerId:'a',seat:1,character:'fire',rune:'none',name:'A'},{playerId:'b',seat:2,character:'rune',rune:'none',name:'B'}],
  T0,'m1',{rounds:5,seed:123,roundStyle:'counted'});
const me=m=>m.participants.find(p=>p.seat===1);
function type(m,at,wrong=false){
  const p=me(m);const word=m.round.words[p.roundWordIndex];
  const out=submitWord(m,{playerId:p.playerId,matchId:m.id,wordIndex:p.wordIndex,text:wrong?word+'x':word,round:m.round.index},at);
  assert.ok(out.match,out.error);return out;
}
const withStreak=(m,n)=>{const c=structuredClone(m);me(c).combo=n;return c;};

test('yarıya inme tablosu: 8→4, 7→3, 5→2, 3→1, 1→0, 0→0',()=>{
  for(const [from,to] of [[8,4],[7,3],[5,2],[3,1],[1,0],[0,0],[12,6],[9,4]]){
    assert.equal(wrongStreak(from),to);
    const out=type(withStreak(make(),from),T0+500,true);
    assert.equal(me(out.match).combo,to,`${from}→${to}`);
    assert.equal(out.result.streak,to);assert.equal(out.result.streakBefore,from);
  }
});

test('çarpan yeni seriye göre: 8 (×1,8) → yanlış → 4 (×1)',()=>{
  const out=type(withStreak(make(),8),T0+500,true);
  assert.equal(streakMultiplier(8),1.8);
  assert.equal(out.result.multiplier,streakMultiplier(4));assert.equal(out.result.multiplier,1);
  const high=type(withStreak(make(),16),T0+500,true); // 16→8: hâlâ çarpanlı
  assert.equal(high.result.multiplier,streakMultiplier(8));
});

test('eşik yeniden geçilince yetenek yeniden atılır: 3 → yanlış (1) → 2 → 3 = Q',()=>{
  let m=withStreak(make(),3);
  m=type(m,T0+300,true).match;assert.equal(me(m).combo,1);assert.equal(m.pendingAttacks.length,0);
  let out=type(m,T0+600);m=out.match;assert.equal(me(m).combo,2);assert.equal(out.result.cast,null);
  out=type(m,T0+900);m=out.match;assert.equal(me(m).combo,3);
  assert.equal(out.result.cast?.skill,'q');assert.equal(m.pendingAttacks.length,1);
});

test('sunucu–istemci aynı kod: yanlış kelime yetenek atmaz, rune enerjisi sıfırlanır',()=>{
  const out=type(withStreak(make(),7),T0+300,true);
  assert.equal(out.result.cast,null);assert.equal(out.match.pendingAttacks.length,0);
});
