import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('player panels expose live identity and authoritative HP without a fixed preview maximum',()=>{
  const template=read('pvp/index.js').match(/function playerHTML\(p\)[\s\S]*?(?=\nfunction screen\()/)?.[0];
  assert.ok(template,'playerHTML exists');
  for(const field of ['data-server-player-name','data-player-connection','data-server-hp-track','data-server-hp-fill','data-server-hp-trail','data-server-shield-layer']){
    assert.ok(template.includes(field),`${field} is present`);
  }
  assert.match(template,/OYUNCU|p\.player/);
  assert.match(template,/p\.name/);
  assert.match(template,/Maç bekleniyor/);
  assert.doesNotMatch(template,/2\.000|2000/,'the template must not imply a mode-specific maximum');
});

test('snapshot renderer uses server maxHp, clamps HP, and paints only transform and opacity layers',()=>{
  const network=read('pvp/network.js');
  const block=network.match(/const playerName=side\.querySelector\('\[data-server-player-name\]'\);[\s\S]*?(?=\n      const combo=)/)?.[0];
  assert.ok(block,'player-panel snapshot update exists');
  assert.match(block,/p\?\.name/);
  assert.match(block,/Number\.isFinite\(p\.maxHp\)&&p\.maxHp>0/);
  assert.match(block,/Math\.max\(0,Math\.min\(p\.maxHp,p\.hp\)\)/);
  assert.match(block,/const ratio=currentHp\/maxHp/);
  assert.match(block,/scaleX\(\$\{ratio\}\)/);
  assert.match(block,/data-server-hp-trail/);
  assert.match(block,/shieldUntil>serverNow/);
  assert.doesNotMatch(block,/writeWidth|\.style\.width|2000|3000|1200/);
});

test('panel styles have 10 percent ticks, delayed damage trail, low HP and reduced motion rules',()=>{
  const css=read('pvp/player-panel.css');
  assert.match(css,/background:linear-gradient\(90deg,transparent calc\(100% - 1px\)[^}]*10% 100% repeat-x/);
  assert.match(css,/health-trail[^}]*transition:transform 550ms 220ms/);
  assert.match(css,/health-fill[^}]*transition:transform 170ms/);
  assert.match(css,/data-low="true"/);
  assert.match(css,/data-active="true"/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/pvp4-reduced/);
  for(const [,size] of css.matchAll(/font-size:(\d+(?:\.\d+)?)px/g))assert.ok(Number(size)>=15,`80% zoom makes ${size}px too small`);
  assert.doesNotMatch(css,/@keyframes|animation\s*:/);
});
