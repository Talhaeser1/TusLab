// "Karakterler beyaza dönüyor" hatası: vuruş çakması ve yetenek parıltısı dokuyu beyaza yakmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TINT_LIMITS} from '../pvp/fighters3d.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('çakma/parıltı sınırları: dövüşçü düz beyaza dönmez', () => {
  assert.ok(TINT_LIMITS.flashColor <= 0.35, 'renk beyaza en çok %35 yaklaşır');
  assert.ok(TINT_LIMITS.emissiveCap <= 1, 'emisyon dinlenme değerinin en çok 1 üstüne çıkar');
  assert.ok(TINT_LIMITS.flashEmissive <= TINT_LIMITS.emissiveCap);
  const src = read('../pvp/fighters3d.js');
  assert.doesNotMatch(src, /flash \* 3/, 'eski 3× emisyon katkısı yok');
  assert.match(src, /Math\.min\(rest\.emissive\.r \+ cap/, 'emisyon üst sınırlı');
});

test('üst üste vuruşlarda çakma 260 ms\'de en çok bir kez yenilenir', () => {
  const src = read('../pvp/arena3d.js');
  assert.match(src, /lastImpactFlashAt > now\(\) - 260/);
});
