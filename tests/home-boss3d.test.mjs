import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../pvp/home-boss3d.js', import.meta.url), 'utf8');

test('ana ekran: Liderlik ve Başarımlar menüden/panelden kalktı', () => {
  assert.doesNotMatch(app, /Liderlik Tablosu|Başarımlar|data-action="badges"|case 'leaderboard'|phase4-badges-card/);
});

test('ana ekran boss modülü: yerel three.js + GLB, görsel yedek, reduced-motion ve gizli sekme', () => {
  assert.ok(existsSync(new URL('../assets/models/harf-muhafizi/harf-muhafizi.glb', import.meta.url)));
  assert.match(mod, /\.\/vendor\/three\.module\.min\.js/);
  assert.match(mod, /\.\/vendor\/GLTFLoader\.js/);
  assert.match(mod, /document\.hidden/);
  assert.match(mod, /reduced-motion/);
});

test('KESINYAP iş 9: ana ekran 3B boss bağlanmaz, eski görsel (arena-king.webp) kalır; modül dosyası durur', () => {
  const css = readFileSync(new URL('../ui-polish-home.css', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /mountHomeBoss3d|home-boss3d\.js|mountHomeBoss/);
  assert.doesNotMatch(css, /home-boss3d/);
  assert.match(app, /arena-king\.webp/);
  assert.ok(existsSync(new URL('../pvp/home-boss3d.js', import.meta.url)));
});
