import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaSummaryModel,arenaResultModel,recordArenaAttack,recordArenaSnapshot} from '../pvp/arena-ui.js';

const matchId='summary-test-match';
const players=[{seat:1,playerId:'me',name:'Ben',hp:2600,maxHp:3000,damageDealt:400,correctWords:4,wrongWords:1,maxCombo:4},
  {seat:2,playerId:'other',name:'Rakip',hp:2700,maxHp:3000,damageDealt:300,correctWords:3,wrongWords:2,maxCombo:3}];
const scores=[{seat:1,correct:4,wrong:1,bestStreak:4,damageDealt:400,hpLeft:2600},
  {seat:2,correct:3,wrong:2,bestStreak:3,damageDealt:300,hpLeft:2700}];
const match={matchId,mode:'arena',status:'running',round:{index:1,total:6,phase:'summary',words:[]},
  me:{...players[0],picks:{skill:'freeze',item:'combostone'}},opponent:players[1],players,
  combatEvents:[{id:1,type:'ARENA_PREP_START',round:1}]};

test('round summary counts each attack once, including combo and lost damage',()=>{
  recordArenaSnapshot(match);
  const attacks=[
    {id:2,type:'ARENA_ATTACK',fromSeat:1,amount:150,penalty:.25,multiplier:1.75,tags:['KOMBO']},
    {id:3,type:'ARENA_ATTACK',fromSeat:1,amount:250,penalty:0,multiplier:2.4,tags:['FİNAL']},
    {id:4,type:'ARENA_ATTACK',fromSeat:2,amount:300,penalty:0,multiplier:1,tags:['AĞIR']}
  ];
  for(const event of attacks)recordArenaAttack(matchId,1,event);
  recordArenaAttack(matchId,1,attacks[0]);
  recordArenaSnapshot({...match,combatEvents:[...match.combatEvents,...attacks]});
  const picks=[{seat:1,skill:'freeze',item:'combostone'},{seat:2,skill:'timethief',item:'gauntlet'}];
  const summary=arenaSummaryModel({round:1,scores,picks},match,'me');
  assert.equal(summary.rows.find(r=>r.label==='Doğru').values[0],'4');
  assert.deepEqual(summary.rows.find(r=>r.label==='KOMBO / FİNAL').values,['1 / 1','0 / 0']);
  assert.deepEqual(summary.rows.find(r=>r.label==='Ceza kaybı').values,['50','0']);
  assert.match(summary.rows.find(r=>r.label==='Skill').values[0],/Donmuş An/);
  assert.match(summary.rows.find(r=>r.label==='Skill').values[1],/Zaman Hırsızı/);
  assert.match(summary.rows.find(r=>r.label==='Eşya').values[1],/Ağır Eldiven/);
  assert.equal(summary.rows.find(r=>r.label==='Kalan HP').values[0],'2.600');
  const empty=arenaSummaryModel({round:1,scores,picks:[{seat:1,skill:null,item:null},{seat:2,skill:null,item:null}]},match,'me');
  assert.deepEqual(empty.rows.find(r=>r.label==='Skill').values,['—','—']);
  assert.deepEqual(empty.rows.find(r=>r.label==='Eşya').values,['—','—']);
  const old=arenaSummaryModel({round:1,scores},match,'me',{record:{rounds:new Map()}});
  assert.equal(old.rows.find(r=>r.label==='Skill').values[1],'Açıklanmadı');
});

test('result model keeps server totals and round entries',()=>{
  const result={matchId,mode:'arena',endReason:'ROUNDS',winnerSeat:1,mvpSeat:1,players,
    rounds:[{round:1,scores,winnerSeat:1,picks:[{seat:1,skill:'freeze',item:'combostone'},
      {seat:2,skill:'timethief',item:null}]}]};
  const model=arenaResultModel(result,'me');
  assert.equal(model.rows[0].damage,'400');
  assert.equal(model.rows[0].penalty,'50');
  assert.equal(model.rounds[0].damage[0],'400');
  assert.equal(model.rounds[0].damage[1],'300');
  assert.equal(model.rounds[0].picks.length,2);
  assert.match(model.rounds[0].picks[0],/Donmuş An/);
  assert.match(model.rounds[0].picks[1],/Zaman Hırsızı/);
  assert.match(model.rounds[0].picks[1],/—/);
  const old=arenaResultModel({...result,rounds:[{round:1,scores,winnerSeat:1}]},'me',{record:{rounds:new Map()}});
  assert.match(old.rounds[0].picks[1],/Açıklanmadı/);
});
