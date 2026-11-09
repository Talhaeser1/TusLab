import test from 'node:test';
import assert from 'node:assert/strict';
import {roundSkillPickerModel,roundsViewModel,roundInputLock,ROUND_SKILL_CARDS} from '../pvp/rounds-ui.js';

const fixture=()=>({matchId:'skills',status:'running',mode:'rounds',totalRounds:5,roundsWon:{1:0,2:0},
  round:{index:2,total:5,phase:'intermission',words:[],endsAt:40_000,nextRoundAt:45_000},
  roundSkillUsesLeft:{timethief:2,blindclock:1,freeze:0},roundSkillPick:null,roundSkillPickLocked:false,
  players:[{playerId:'human',seat:1,name:'İnsan',roundWordIndex:0},{playerId:'bot',seat:2,name:'Bot',roundWordIndex:0}]});

test('süre becerisi seçici yalnız tur arasında açılır ve kullanım haklarını gösterir',()=>{
  const m=fixture();const picker=roundSkillPickerModel(m,'human');
  assert.equal(picker.visible,true);assert.deepEqual(picker.cards.map(c=>c.left),[2,1,0]);
  assert.deepEqual(ROUND_SKILL_CARDS.map(c=>c.id),['timethief','blindclock','freeze']);
  assert.equal(roundSkillPickerModel({...m,round:{...m.round,phase:'round'}},'human').visible,false);
  assert.equal(roundSkillPickerModel(m,'unknown').visible,false);
});

test('kişisel bitişler ve kör saat iki tarafta da doğru gösterilir',()=>{
  const m=fixture();m.round.phase='round';m.round.words=Array(10).fill('kelime');
  m.round.personalEndsAt={1:25_000,2:33_000};m.round.endsAt=33_000;
  m.players[0].roundEndsAt=25_000;m.players[1].roundEndsAt=33_000;
  m.round.skills={1:'freeze',2:'timethief'};
  const vm=roundsViewModel(m,'human',20_000,new Map());
  assert.equal(vm.timer.seconds,5);assert.deepEqual(vm.sides.map(s=>s.clock),['5','13']);
  assert.match(vm.sides[0].badge,/❄ \+3 sn/);assert.match(vm.sides[0].badge,/−5 sn/);
  assert.equal(roundInputLock(m,'human',25_000).locked,true);
  m.blindClock=true;m.round.endsAt=null;m.round.personalEndsAt=null;
  for(const p of m.players)p.roundEndsAt=null;
  const blind=roundsViewModel(m,'human',20_000,new Map());
  assert.equal(blind.timer.text,'🌑 —');assert.deepEqual(blind.sides.map(s=>s.clock),['🌑 —','🌑 —']);
  assert.equal(blind.lastCall.active,false);
  assert.equal(roundInputLock(m,'human',40_000).locked,false);
});
