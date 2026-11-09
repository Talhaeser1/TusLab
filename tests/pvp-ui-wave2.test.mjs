import test from 'node:test';
import assert from 'node:assert/strict';
import {arenaResultModel} from '../pvp/arena-ui.js';

test('arena result presents server final HP and MVP without recomputing either',()=>{
  const result={mode:'arena',endReason:'ROUNDS',winnerSeat:1,mvpSeat:2,
    players:[
      {seat:2,playerId:'b',name:'Mavi',hp:850,maxHp:3000,damageDealt:2700,correctWords:18,wrongWords:2,maxCombo:7},
      {seat:1,playerId:'a',name:'Kızıl',hp:1200,maxHp:3000,damageDealt:2150,correctWords:15,wrongWords:3,maxCombo:4}
    ],rounds:[]};
  const model=arenaResultModel(result,'a');
  assert.equal(model.rows[0].hp,'1.200 / 3.000 HP');
  assert.equal(model.rows[1].hp,'850 / 3.000 HP');
  assert.equal(model.rows[0].winner,true);
  assert.equal(model.mvp,'Mavi');
});
