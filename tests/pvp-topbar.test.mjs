import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('üst bar maç bilgisini tek merkez grupta toplar',()=>{
  const source=read('../pvp/pvp-main.js');
  const screen=source.slice(source.indexOf('function screen(){'),source.indexOf('function textUpdate('));
  assert.match(screen,/class="pvp-topbar-start"/);
  assert.match(screen,/class="pvp-topbar-center"/);
  assert.match(screen,/class="pvp2-actions"/);
  for(const attr of ['data-match-status','data-match-timer','data-match-sequence','data-pvp12-ping','data-net-status','data-practice-chip']){
    assert.ok(source.includes(attr),`${attr} korunmalı`);
  }
  assert.match(source,/topbarArrangeStatus\(\);/);
  assert.equal((screen.match(/data-match-timer/g)||[]).length,1);
  assert.equal((screen.match(/data-match-sequence/g)||[]).length,1);
  assert.doesNotMatch(screen,/İKİ SAVAŞÇI, BİR SİNEMATİK ARENA/);
});

test('2B arka plan görsel indirmez ve 3B kolezyumu ezmez',()=>{
  const backdrop=read('../pvp/backdrop.css');
  const topbar=read('../pvp/topbar.css');
  assert.match(backdrop,/#pvp-root:not\(\.pvp26-3d\) \.pvp2-shell/);
  assert.match(backdrop,/#pvp-root:not\(\.pvp26-3d\) \.pvp2-stage/);
  assert.doesNotMatch(backdrop,/url\(|animation\s*:/);
  assert.match(topbar,/grid-template-columns/);
  assert.match(topbar,/\[data-practice-chip\]:not\(\[hidden\]\)/);
  assert.doesNotMatch(topbar,/backdrop-filter|animation\s*:/);
});
