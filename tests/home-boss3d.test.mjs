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
  assert.match(app, /import\('\.\/pvp\/home-boss3d\.js'\)/);
});
