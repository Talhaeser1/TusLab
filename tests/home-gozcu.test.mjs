// Gözcü turu (21. iş, 24 Kas 2026): ana sitenin düğme/tuş/görev denetimi. Bulunan hataların geri gelmesini önler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resultEvent } from '../home/lessons.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const js = read('home/home.js');
const css = read('home/home.css');
const edu = read('home/egitim.css');
const lessons = read('home/lessons.js');
const lit = read('home/literature.js');
const typing = read('home/typing.js');
const tpl = js.slice(js.indexOf('<div class="tlh-menu">'), js.indexOf('<section class="tlh-view tlh-write"'));

test('ders ve alıştırma sonucu bir olay kaydı bırakır (tekrar da görev/seri/geçmiş sayılsın)', () => {
  const all = { bestWpm: 10, lessons: {} };
  resultEvent({ wpm: 42, acc: 99, weakKeys: { f: 1 } }, { kind: 'lesson', pass: true, lesson: 'L01' })(all);
  assert.equal(all.last.wpm, 42);
  assert.equal(all.last.acc, 99);
  assert.equal(all.last.pass, true);
  assert.equal(all.last.kind, 'lesson');
  assert.deepEqual(all.last.weak, { f: 1 });
  assert.ok(all.last.t > 0);
  // ders, zayıf tuş ve serbest alıştırma: üçü de olay bırakır
  assert.match(lessons, /resultEvent\(st, \{ kind: 'lesson', pass: r\.pass, lesson: lesson\.id \}\)\(all\)/);
  assert.match(lessons, /bumpProgress\(ctx, st\.wpm, st\.acc, resultEvent\(st, \{ kind: 'weak' \}\)\)/);
  assert.match(lessons, /bumpProgress\(ctx, st\.wpm, st\.acc, resultEvent\(st, \{ kind: 'free' \}\)\)/);
  // Şiir & Atasözü oturumu: biten parça sayısıyla
  assert.match(lit, /all\.last = \{ wpm: st\.wpm, acc: st\.acc, t: Date\.now\(\), weak: st\.weakKeys \|\| null, kind: 'lit', cat: c\.id, n: st\.chunks \|\| 0 \}/);
});

test('kabuk olay kaydını okur, depoya yazmaz; ders geçince "1 ders bitir", Şiir & Atasözü en az 1 metinle "lit" sayılır', () => {
  assert.match(js, /const L = obj\.last && typeof obj\.last === 'object' && typeof obj\.last\.wpm === 'number' \? obj\.last : null;/);
  assert.match(js, /delete rest\.last;/);
  assert.match(js, /delete d\.sec\[id\]\.last;/);
  assert.match(js, /if \(id === 'egitim'\) \{ finished = true; if \(L\.pass\) quests\.push\('lesson'\); \}/);
  assert.match(js, /if \(num\(L\.n\) >= 1\) \{ finished = true; quests\.push\('lit'\); \}/);
  assert.match(js, /progress\(\{ quests, finished, wpm, acc, mode, weak \}\)/);
  // eski yol (yıldız artışı) yedek olarak duruyor
  assert.match(js, /if \(id === 'egitim' && lessonStars\(\) > before\) \{ quests\.push\('lesson'\); finished = true; \}/);
});

test('görevler: üçü bitince kutlama, sekmeye dönünce gün değiştiyse yenilenir', () => {
  assert.match(js, /msgs\.push\(`Bugünün \$\{ids\.length\} görevi tamam! Yarın yenileri gelir\.`\)/);
  assert.match(js, /if \(visDay !== today\(\) \|\| !view\) \{ visDay = today\(\); data = readStore\(\); renderStats\(\); \}/);
  // görev havuzu: 2 sabit + 4'lü dönüşüm; rozet listesi 8
  assert.match(js, /const rot = \['daily', 'wpm35', 'lit', 'arena'\];/);
  assert.match(js, /return \['lesson', 'acc98', rot\[h % rot\.length\]\];/);
  // rozet listesi 8: her birinin koşulu (need), hedefi (goal) ve ilerlemesi (cur) var (Performans vitrini, Terazi)
  assert.equal((js.match(/\{ id: '[a-z0-9]+', icon: '[^']+', name: '[^']+', need: '[^']+', goal: \d+, cur: d =>/g) || []).length, 8);
});

test('Yazma kartı: bölüm + 6 işlevli tür çipi (data-wmode) + kişisel rozetler + "Yazmaya başla" düğmesi', () => {
  assert.match(tpl, /<section class="tlh-c tlh-c-write" data-tlh="write" aria-labelledby="tlh-cw-h">/);
  assert.match(js, /const WMODES = \[\['atasozu', 'Atasözü'\], \['siir', 'Şiir'\], \['deyim', 'Deyim'\], \['tekerleme', 'Tekerleme'\], \['ozdeyis', 'Özdeyiş'\], \['kelime', 'Kelime'\]\];/);
  assert.match(tpl, /<button type="button" class="tlh-cw-tag" data-wmode="\$\{id\}" aria-label="\$\{esc\(l\)\} ile yazmaya başla">/);
  assert.match(js, /if \(t\.dataset\.wmode\) \{/);
  assert.match(js, /\[data-mode="kelime"\],\[data-wmode="kelime"\]/);   // kelime havuzu önden yüklenir
  assert.match(tpl, /<ul class="tlh-cw-me" aria-label="Senin sayıların">/);
  for (const k of ['cw-last', 'cw-best', 'cw-n']) assert.match(js, new RegExp(`setAll\\('${k}'`));
  // telefonda rozetler klavye görselinin üstüne binmesin
  assert.match(css, /#tl-home \.tlh-cw-me \{ display: none; \}/);
});

test('Performans kartı: boşken örnek eğri ve davet düğmesi üst üste binmez, görevler ayrı bölümde', () => {
  assert.match(css, /#tl-home \.tlh-met-slot\.is-empty \.tlh-met-cap \{ display: none; \}/);
  assert.match(css, /#tl-home \.tlh-met-slot \.tlh-ch-empty svg \{ top: 0; height: calc\(100% - 48px\);/);
  assert.match(css, /#tl-home \.tlh-mq-box \{[^}]*border-top: 1px solid/);
});

test('kısa ekran (1280×720): Serbest Alıştırma seçimi kaymadan sığar; çift egitim.css yok', () => {
  assert.match(edu, /@media \(max-height: 800px\) and \(min-width: 700px\) \{\s*\.tl-edu \.tl-free-opts \{ gap: 8px;/);
  assert.match(typing, /document\.querySelector\('link\[data-tlh-css\]'\)\) return;/);
});

test('dokunmatik ve telefon yatay: 44 px hedefler, sekmeler üst çubukta', () => {
  assert.match(css, /#tl-home \.tlh-cw-tag, #tl-home \.tlh-c-write \.tlh-c-go, #tl-home \.tlh-logo \{ min-height: 44px; \}/);
  assert.match(css, /#tl-home \.tlh-back, #tl-home \.tlh-mode, #tl-home \.tlh-next, #tl-home \.tlh-result-btns \.tlh-btn \{ min-height: 44px; \}/);
  assert.match(edu, /@media \(pointer: coarse\) \{\s*\.tl-edu \.tl-btn, \.tl-edu \.tl-ws-acts \.tl-btn/);
  assert.match(css, /@media \(max-width: 860px\) and \(max-height: 500px\) and \(orientation: landscape\) \{[\s\S]*?\.tlh-nav \{\s*position: static;/);
  // dar yatayda etiketler görünmez ama erişilebilir kalır (display:none değil)
  assert.match(css, /\.tlh-nav-btn em \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\);/);
});

test('erişilebilir adlar: ders adımı, görev satırı, PvP kartı', () => {
  assert.match(js, /aria-label="Ders \$\{i \+ 1\}: \$\{esc\(l\.title\)\}, /);
  assert.match(js, /aria-label="\$\{esc\(Q\.text\)\}: \$\{have\}\/\$\{need\}, başla"/);
  assert.match(tpl, /data-card="pvp" aria-label="PvP Düello: yazarak dövüş, bot ya da arkadaşla\. Lobiye git"/);
  // azaltılmış harekette yeni öğeler de kıpırdamaz
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.tlh-cw-tag:hover/);
});

test('ekran klavyesi düğmesi: tercih ortak, sayfadaki bütün düğmeler aynı durumu gösterir', () => {
  assert.match(typing, /b\._tlPaint = paint;/);
  assert.match(typing, /document\.querySelectorAll\('\.tl-kbtoggle'\)\.forEach\(\(x\) => \{ if \(typeof x\._tlPaint === 'function'\) x\._tlPaint\(\); \}\);/);
});

test('kısa deneme rekoru şişirmez: Yazma akışında <20 harf ve 0 metin, Şiir & Atasözü\'nde 0 metin', () => {
  assert.match(js, /const short = !complete && num\(s\.typed\) < 20;/);
  assert.match(js, /const \{ record \} = short \? \{ record: false \} : progress\(/);
  assert.match(js, /else \{ wpm = 0; acc = 0; \}/);
  assert.match(lit, /bumpProgress\(ctx, \(st\.chunks \|\| 0\) >= 1 \? st\.wpm : 0, st\.acc,/);
});
