import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPvPState,pvpReducer,createPvPStore,PvPView,PvPConnection} from '../pvp/state.js';
import {makeEnvelope,MessageType,PROTOCOL_VERSION} from '../pvp/contracts.js';

test('initial state is offline without fictitious room, opponent or match',()=>{
 const s=initialPvPState();assert.equal(s.view,PvPView.CLOSED);assert.equal(s.connection,PvPConnection.UNCONFIGURED);assert.equal(s.match,null);assert.equal(s.roomId,null);assert.equal(s.opponent,null);
});
test('opening / closing PvP preserves room and single-player separation',()=>{
 const base=initialPvPState();const open=pvpReducer(base,{type:'PVP_OPEN'});assert.equal(open.view,PvPView.HOME);assert.equal(base.view,PvPView.CLOSED);
 const closed=pvpReducer(open,{type:'PVP_CLOSE'});assert.equal(closed.view,PvPView.CLOSED);
});
test('store notifies subscribers only when state actually changes',()=>{
 const store=createPvPStore();let calls=0;const unsubscribe=store.subscribe(()=>calls++);store.dispatch({type:'UNKNOWN'});assert.equal(calls,0);store.dispatch({type:'PVP_OPEN'});assert.equal(calls,1);unsubscribe();store.dispatch({type:'PVP_CLOSE'});assert.equal(calls,1);
});
test('invalid network messages are rejected at contract boundary',()=>{
 assert.deepEqual(makeEnvelope(MessageType.ROOM_JOIN,{room:'abc'}),{version:PROTOCOL_VERSION,type:'ROOM_JOIN',payload:{room:'abc'}});
 assert.throws(()=>makeEnvelope('GRANT_XP',{xp:999}));assert.throws(()=>makeEnvelope(MessageType.ROOM_JOIN,null));
});
