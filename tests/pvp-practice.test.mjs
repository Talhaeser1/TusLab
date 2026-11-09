import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as serverEngine from '../cloudflare/src/match.js';
import * as sharedEngine from '../pvp/shared/match.js';
import {createPracticeSession,BOT_DIFFICULTIES,botWordDelay,makeTypo,HUMAN_ID,BOT_ID,PRACTICE_REMATCH_DELAY_MS} from '../pvp/practice.js';

/** Named exports of cloudflare/src/match.js before the engine moved to pvp/shared. */
const ORIGINAL_EXPORTS=['COOLDOWNS','CYCLE_DAMAGE','DAMAGE','DEFENSE_RULES','MATCH_DURATION_MS','MATCH_HP','MATCH_WORDS',
  'RUNES','RUNE_IDS','SERVER_ONLY_EVENTS','SHIELD_DURATION_MS','SHIELD_PROBABILITY','SHIELD_WINDOW_MS','TALENT_RULES',
  'ULTIMATE_PHASES','computeSkillBonus','createMatch','endDisconnectedMatch','finishMatch','matchResult','pauseMatch',
  'publicMatch','resolveDueAttacks','resumeMatch','submitWord','surrenderMatch','validateRune',
  // Round mode (docs/TUR-SISTEMI.md §7.4) — re-exported as well.
  'MULTIPLIER_CAP','MULTIPLIER_START','MULTIPLIER_STEP','ROUND_DURATION_MS','ROUND_HP','ROUND_INTRO_MS','ROUND_LAST_CALL_MS',
  'ROUND_OPTIONS','ROUND_SCORE','ROUND_SETTLE_MS','ROUND_SUMMARY_MS','ROUND_WORDS','STREAK_SKILLS','SUDDEN_DEATH_MAX',
  'ULTIMATE_RETURN_MS','advanceMatch','nextDeadline','normalizeRounds','roundScore','roundStartPayload','streakMultiplier'];

/** Deterministic PRNG (mulberry32). */
function seeded(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** Virtual clock + scheduler: advance() runs due timers in time order. */
function fakeClock(start=1_700_000_000_000){
  let t=start,seq=0;const timers=new Map();
  const add=(fn,ms,repeat)=>{const id=++seq;timers.set(id,{fn,at:t+Math.max(0,ms|0),ms:Math.max(1,ms|0),repeat});return id;};
  return {
    now:()=>t,active:()=>timers.size,
    scheduler:{setTimeout:(f,ms)=>add(f,ms,false),clearTimeout:id=>timers.delete(id),setInterval:(f,ms)=>add(f,ms,true),clearInterval:id=>timers.delete(id)},
    advance(ms){
      const end=t+ms;
      for(;;){
        let id=null,next=null;
        for(const [k,x] of timers)if(x.at<=end&&(!next||x.at<next.at||(x.at===next.at&&k<id))){id=k;next=x;}
        if(!next)break;
        t=next.at;if(next.repeat)next.at+=next.ms;else timers.delete(id);
        next.fn();
      }
      t=end;
    }
  };
}
function setup({seed=7,difficulty='orta',character='fire',ids=true}={}){
  const clock=fakeClock();const packets=[],combat=[],words=[],snapshots=[];let n=0;
  const session=createPracticeSession({difficulty,character,rng:seeded(seed),now:clock.now,scheduler:clock.scheduler,
    createId:ids?()=>`practice-test-${++n}`:undefined,
    onPacket:p=>packets.push(p),onCombat:e=>combat.push(e),onWordResult:r=>words.push(r),onMatch:m=>snapshots.push(m)});
  return {clock,session,packets,combat,words,snapshots};
}
/** A scripted human that types the current word every `everyMs` (with an occasional typo). */
function humanTyper(ctx,everyMs=1500){
  ctx.clock.scheduler.setInterval(()=>{
    const m=ctx.session.match;if(m?.status!=='running')return;
    const me=m.participants.find(p=>p.playerId===HUMAN_ID);
    const typo=me.wordIndex%9===8;
    ctx.session.send('WORD_SUBMIT',{matchId:m.id,wordIndex:me.wordIndex,text:typo?me.currentWord+'q':me.currentWord});
  },everyMs);
}

test('practice: cloudflare/src/match.js still exports everything it did before (re-export of the shared engine)',()=>{
  // Eski ihracatların hepsi yerinde olmalı; ek ihracatlara yalnızca Arena modu için izin var.
  for(const name of ORIGINAL_EXPORTS)assert.ok(name in serverEngine,`eksik ihracat: ${name}`);
  const extra=Object.keys(serverEngine).filter(k=>!ORIGINAL_EXPORTS.includes(k));
  for(const name of extra)assert.match(name,/arena/i,`beklenmeyen ek ihracat: ${name}`);
  for(const name of ORIGINAL_EXPORTS)assert.equal(serverEngine[name],sharedEngine[name],name);
  const shim=readFileSync(new URL('../cloudflare/src/match.js',import.meta.url),'utf8');
  assert.match(shim,/from '\.\.\/\.\.\/pvp\/shared\/match\.js'/);
  const build=readFileSync(new URL('../cloudflare/build-assets.mjs',import.meta.url),'utf8');
  assert.match(build,/'pvp','shared'/);
});

test('practice: a full deterministic match runs to an end state with real engine events',()=>{
  const run=()=>{
    const ctx=setup({seed:42,difficulty:'zor'});humanTyper(ctx,1400);
    ctx.session.start();
    ctx.clock.advance(140_000);
    return ctx;
  };
  const a=run(),b=run();
  const end=a.session.snapshot();
  assert.equal(end.status,'ended');
  assert.equal(end.result.mode,'rounds');
  assert.ok(['ROUNDS','ROUNDS_DRAW'].includes(end.endReason));
  assert.ok(end.result&&end.result.players.length===2);
  // Same seed + same clock = byte-identical outcome.
  assert.deepEqual(b.session.snapshot(),end);
  assert.deepEqual(b.packets.map(p=>p.type),a.packets.map(p=>p.type));
  // Packets use the exact server envelope.
  const start=a.packets.find(p=>p.type==='MATCH_START');
  assert.equal(start.version,1);assert.equal(start.matchId,'practice-test-1');
  assert.equal(start.eventId,`${start.matchId}:${start.sequence}:MATCH_START`);
  assert.ok(a.packets.some(p=>p.type==='MATCH_END'));
  // Combo skills fired through the real engine for both fighters.
  const casts=a.combat.filter(e=>e.type==='SKILL_CAST');
  assert.ok(casts.some(e=>e.fromSeat===1)&&casts.some(e=>e.fromSeat===2));
  assert.ok(a.combat.some(e=>e.type==='ULTIMATE_PHASE'));
  assert.ok(a.combat.some(e=>e.type==='DAMAGE_APPLIED'));
  // Human results only; bot WORD_RESULTs are never sent (server sends them only to the submitter).
  assert.ok(a.words.length>0&&a.words.every(w=>w.accepted===false||w.seat===1));
  // Timers stop once the match ends (only the test's own typer interval remains).
  assert.equal(a.session.activeTimers,0);
});

test('practice: combat event ids strictly increase and match snapshots never go backwards',()=>{
  const ctx=setup({seed:3,difficulty:'zor'});humanTyper(ctx,900);
  ctx.session.start();ctx.clock.advance(60_000);
  assert.ok(ctx.combat.length>5);
  for(let i=1;i<ctx.combat.length;i++)assert.ok(ctx.combat[i].id>ctx.combat[i-1].id,'ids must increase');
  // Each combat packet carries {event} like room.broadcastCombat.
  const combatPackets=ctx.packets.filter(p=>p.payload?.event);
  assert.deepEqual(combatPackets.map(p=>p.payload.event.id),ctx.combat.map(e=>e.id));
  const seqs=ctx.snapshots.map(s=>s.match.sequence);
  for(let i=1;i<seqs.length;i++)assert.ok(seqs[i]>=seqs[i-1]);
});

test('practice: bot difficulty changes typing speed',()=>{
  const typed=difficulty=>{
    const ctx=setup({seed:11,difficulty});ctx.session.start();ctx.clock.advance(20_000);
    const bot=ctx.session.match.participants.find(p=>p.playerId===BOT_ID);
    return bot.correctWords+bot.wrongWords;
  };
  const kolay=typed('kolay'),orta=typed('orta'),zor=typed('zor');
  // Resolve locks typing after ten words; orta and zor can both reach that cap before 20 s.
  assert.ok(kolay<orta&&orta<=zor,`kolay ${kolay} < orta ${orta} <= zor ${zor}`);
  // The bot has at most 10 attempts per round; fast bots may enter round two.
  assert.ok(kolay>=3&&kolay<=10,String(kolay));assert.ok(zor>=10&&zor<=20,String(zor));
  assert.deepEqual(Object.keys(BOT_DIFFICULTIES),['kolay','orta','zor']);
  const rng=seeded(1);const slow=botWordDelay('savaşçı',{...BOT_DIFFICULTIES.kolay,jitter:0,pause:0},rng);
  const fast=botWordDelay('savaşçı',{...BOT_DIFFICULTIES.zor,jitter:0,pause:0},rng);
  assert.equal(slow,Math.round(8*60_000/(25*5)));assert.ok(fast<slow);
  for(const w of ['a','güçlü','kazanır.'])assert.notEqual(makeTypo(w,seeded(5)),w);
});

test('practice: dispose clears every timer and silences the session',()=>{
  const ctx=setup({seed:5});ctx.session.start();
  ctx.clock.advance(3_000);
  assert.ok(ctx.session.activeTimers>0&&ctx.clock.active()>0);
  ctx.session.dispose();
  assert.equal(ctx.session.activeTimers,0);assert.equal(ctx.clock.active(),0);
  const count=ctx.packets.length;
  ctx.clock.advance(100_000);
  ctx.session.send('WORD_SUBMIT',{matchId:'x',wordIndex:0,text:'x'});
  assert.equal(ctx.packets.length,count);
  // LEAVE disposes as well.
  const other=setup({seed:6});other.session.start();other.session.send('LEAVE',{});
  assert.equal(other.clock.active(),0);assert.ok(other.session.disposed);
});

test('practice: surrender, rematch (new match) and seat follows chosen fighter',()=>{
  const ctx=setup({seed:9,character:'rune'});
  assert.equal(ctx.session.humanSeat,2);assert.equal(ctx.session.botSeat,1);
  ctx.session.start();ctx.clock.advance(2_000);
  const m=ctx.session.match;
  assert.equal(m.participants.find(p=>p.seat===1).character,'fire');
  assert.equal(m.participants.find(p=>p.seat===2).character,'rune');
  // Human typing is validated by the engine exactly as on the server.
  const me=m.participants.find(p=>p.playerId===HUMAN_ID);
  ctx.session.send('WORD_SUBMIT',{matchId:m.id,wordIndex:me.wordIndex,text:me.currentWord});
  assert.equal(ctx.words.at(-1).accepted,true);assert.equal(ctx.words.at(-1).correct,true);
  ctx.session.send('WORD_SUBMIT',{matchId:m.id,wordIndex:0,text:'tekrar'});
  assert.equal(ctx.words.at(-1).code,'WORD_INDEX_MISMATCH');
  ctx.session.send('SURRENDER',{});
  assert.equal(ctx.session.snapshot().endReason,'SURRENDER');assert.equal(ctx.session.snapshot().winnerSeat,1);
  assert.deepEqual(ctx.session.rematchVotes,[BOT_ID]);
  const firstId=ctx.session.snapshot().matchId;
  ctx.session.send('REMATCH_VOTE',{accept:true});
  assert.ok(ctx.packets.some(p=>p.type==='REMATCH_COUNTDOWN'));
  ctx.clock.advance(PRACTICE_REMATCH_DELAY_MS+10);
  const fresh=ctx.session.snapshot();
  assert.notEqual(fresh.matchId,firstId);assert.equal(fresh.status,'running');
  assert.equal(fresh.round.index,1);assert.equal(fresh.totalRounds,5);
  assert.equal(ctx.packets.filter(p=>p.type==='MATCH_START').at(-1).payload.rematch,true);
  ctx.session.dispose();assert.equal(ctx.clock.active(),0);
});

test('practice: never calls fetch or any /api endpoint',()=>{
  const src=readFileSync(new URL('../pvp/practice.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/fetch\(|\/api\/|WebSocket|localStorage/);
});
