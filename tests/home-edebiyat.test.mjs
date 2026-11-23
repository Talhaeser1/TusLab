// Ana ekran "Edebiyatla yaz" kartları ve Şiir & Atasözü akışı (Edip, 24 Kas 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const lit = read('home/literature.js');
const IDS = ['atasozu', 'deyim', 'siir', 'tekerleme', 'ozdeyis'];

test('beş tür: sıra ana ekran çiplerinde ve tür menüsünde aynı; Merkez\'de ikinci tür seçici yok', () => {
  const order = (src) => [...src.matchAll(/\{ id: '(\w+)', label: '/g)].map((m) => m[1]).filter((id) => IDS.includes(id));
  assert.deepEqual(order(js), IDS);
  assert.deepEqual(order(lit), IDS);
  assert.doesNotMatch(js, /tlh-modes--hub|hubModesEl/);
  // Sahne: her çipte tür adı + metin sayısı; tür menüsünün kartlarında "Başla" (literature.js)
  assert.match(js, /data-s="litn-\$\{c\.id\}"/);
  assert.match(lit, /class: 'tlh-lit-go' \}, 'Başla '/);
});

test('motifler: elle çizilmiş küçük SVG, betik/dış kaynak yok, CSS maskesiyle tür rengine boyanır', () => {
  for (const id of IDS) {
    const url = new URL(`../assets/home/lit-${id}.svg`, import.meta.url);
    assert.ok(existsSync(url), id);
    assert.ok(statSync(url).size < 2048, `${id} 2 KB'tan büyük`);
    const svg = readFileSync(url, 'utf8');
    assert.match(svg, /^<svg[^>]+viewBox="0 0 24 24"/);
    assert.doesNotMatch(svg, /<script|on\w+=|https?:\/\/(?!www\.w3\.org\/2000\/svg)|<image|@import|<foreignObject/i);
    assert.ok(css.includes(`.tlh-lit--${id} { --acc: `) && css.includes(`--motif: url("../assets/home/lit-${id}.svg")`), `${id} CSS bağı yok`);
  }
  assert.match(css, /mask: var\(--motif\) center \/ contain no-repeat/);
});

test('erişilebilirlik: odak halkası, azaltılmış harekette kayma yok, görünür yazı ≥ 12 px', () => {
  assert.match(css, /#tl-home \.tlh-lit-chip:focus-visible \{ outline: 3px solid var\(--acc\)/);
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.tlh-lit-chip:hover \.tlh-lit-go span/);
  assert.match(css, /html\.reduced-motion #tl-home \.tlh-lit-chip:hover \.tlh-lit-go span/);
  const block = css.slice(css.indexOf('/* --- Şiir & Atasözü tür kartları'), css.indexOf('/* çizgi/alan grafiği'));
  for (const m of block.matchAll(/font(?:-size)?: (?:\d+ )?(\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, 'yazı ' + m[1] + 'px');
});

test('hız: sayılar ve örnekler boşta, tür başına bir kez hesaplanır', () => {
  assert.match(js, /requestIdleCallback/);
  assert.match(js, /idle\(\(\) => \{ litInfo = computeLit\(am\); renderLit\(\); \}\)/);
  assert.doesNotMatch(js, /for \(const m of am\.MODES\) \{ try \{ litCounts/);
});

test('şiir kıtası: dize başlangıçları yazılan satırla birebir örtüşür', async () => {
  const { itemsFor } = await import('../home/arena.js');
  const { lineStarts, lineAt } = await import('../home/literature.js');
  const T = await import('../home/data/texts.js');
  const clean = (s) => String(s ?? '').replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim();
  const byId = new Map(T.POEMS.map((p) => ['p:' + (p.id || p.title), p.lines.map(clean).filter(Boolean)]));
  let checked = 0;
  for (const it of itemsFor('siir')) {
    const lines = byId.get(it.id);
    if (!lines || lines.length < 2) continue;
    const chars = Array.from(it.text);
    const st = lineStarts(lines);
    lines.forEach((l, i) => {
      assert.equal(chars.slice(st[i], st[i] + Array.from(l).length).join(''), l, `${it.id} dize ${i + 1}`);
      assert.equal(lineAt(st, st[i]), i);
    });
    checked++;
  }
  assert.ok(checked >= 10, 'çok az şiir denetlendi: ' + checked);
});

test('oturum: Esc boşken karttan gelindiyse ana ekrana döner; sonuçta Enter = devam, kayıt görünür', () => {
  assert.match(lit, /if \(fromHome && ctx && ctx\.back\) ctx\.back\(\);\s*else renderMenu\(\);/);
  assert.match(lit, /e\.key === 'Enter' && !session && sumFor/);
  assert.match(lit, /Kaydedildi · bu türde toplam/);
  assert.match(lit, /onProgress: \(st\) => markDize\(/);
});
