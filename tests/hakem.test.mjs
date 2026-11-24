// Hakem (docs/25-son-kontrol.md, 24 Kas 2026): gece sonu bağımsız kontrolde ekranda görülüp düzeltilen taşma/çakışmalar.
// Her test, tarayıcıda ekran görüntüsüyle bulunan bir hatanın geri gelmemesini metin düzeyinde kilitler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('hakem: ders haritası ünite çipleri masaüstünde kırılır (1440 px\'te son ünite yarım kesilmiyordu)', () => {
  const css = read('home/egitim.css');
  assert.match(css, /@media \(min-width: 1000px\) \{\s*\.tl-edu \.tl-map-jump \{[^}]*flex-wrap: wrap/);
});

test('hakem: Şiir & Atasözü "Son yazdıkların" kutusu baştan görünür, boşken ipucu taşır; dar ekranda boşken gizli', () => {
  const js = read('home/literature.js');
  assert.match(js, /tl-lit-recentbox is-empty/);
  assert.doesNotMatch(js, /tl-lit-recentbox', hidden: true/);
  assert.match(js, /Bitirdiğin metinler burada birikir\./);
  assert.match(js, /recentBox\.classList\.remove\('is-empty'\)/);
  assert.match(read('home/egitim.css'), /@media \(max-width: 1099px\) \{ \.tl-edu \.tl-lit-recentbox\.is-empty \{ display: none; \} \}/);
});

test('hakem: başlık satırındaki "Bitir" düğmesinde Esc etiketi 900 px altında gizli (768 px\'te düğmeden taşıyordu)', () => {
  assert.match(read('home/egitim.css'), /@media \(max-width: 900px\) \{ \.tl-edu \.tl-ws-head \.tl-typer-stats \.tl-typer-stop kbd \{ display: none; \} \}/);
});

test('hakem: Performans zaman ekseni aynı günde saat yazar, art arda aynı etiketi tekrar etmez', () => {
  const js = read('home/home.js');
  const m = js.match(/const xLabels = \(ts\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, 'xLabels yardımcısı var');
  const shortDate = (t) => { const d = new Date(t); return d.getDate() + ' ' + ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]; };
  const two = (n) => String(n).padStart(2, '0');
  const timeOf = (t) => { const d = new Date(t); return two(d.getHours()) + ':' + two(d.getMinutes()); };
  const xLabels = new Function('shortDate', 'timeOf', m[0].replace('const xLabels = ', 'return '))(shortDate, timeOf);
  const day = new Date(2026, 10, 24, 7, 8).getTime();
  assert.deepEqual(xLabels([day, day + 120000, day + 240000, day + 240000]), ['07:08', '07:10', '07:12', '']);
  const d2 = new Date(2026, 10, 25, 9, 0).getTime();
  assert.deepEqual(xLabels([day, day + 60000, d2]), ['24 Kas', '', '25 Kas']);
  assert.match(js, /xLabels\(xi\.map\(i => num\(list\[i\]\.t\)\)\)/);
  // tek kayıtta doğruluk etiketi noktanın soluna (WPM etiketiyle üst üste biniyordu)
  assert.match(read('home/home.css'), /\.tlh-pc-d\.is-a b \{[^}]*right: 14px/);
});

test('hakem: tablet dikeyde Yazma kartının klavye görseli tür çiplerinin altına girmez', () => {
  assert.match(read('home/home.css'), /@media \(min-width: 600px\) and \(max-width: 860px\) \{\s*#tl-home \.tlh-cw-kb \{ width: min\(60%, 460px\)/);
});

test('hakem: PvP sonuç kartı portresi ve sayıları genişliğe göre sınırlı (768×1024\'te sayılar öbür kartın üstüne biniyordu)', () => {
  const css = read('pvp/results-v2.css');
  assert.match(css, /--r3-ph:clamp\(118px,min\(30vh,22vw\),350px\)/);
  assert.match(css, /\.pvp15-figures strong\{font-size:clamp\(20px,min\(3\.6vh,2\.6vw\),36px\)/);
  assert.match(css, /@media\(min-width:761px\) and \(max-width:1000px\)\{\s*#pvp-root \.pvp15-scene \.pvp15-figures\{gap:0 10px\}/);
});

test('hakem: telefon yatayda tur arası açıkken kelime şeritleri gizli (bant başlığı üstlerine biniyordu)', () => {
  assert.match(read('pvp/rounds-ui.css'), /#pvp-root#pvp-root\.rui-inter-open \.mi-strip\{visibility:hidden\}/);
});

test('hakem: lobide bağlantı yokken "Bağlı değil" satırı gizli; ray notu sahne ışığında okunur', () => {
  assert.match(read('pvp/network.js'), /lobbyState\.hidden=this\.status==='Bağlı değil'/);
  assert.match(read('pvp/fight-hud.css'), /\.fhud2 \.fhud2-rail-note\{[^}]*background:rgba\(6,4,18,\.62\)/);
});

test('hakem: ana sayfa sözleşmesi kaldırılan dailyLine()/scene3d.js dışa aktarımlarını artık anmaz', () => {
  const doc = read('docs/codex/ANASAYFA-SOZLESME.md');
  assert.doesNotMatch(doc, /export function dailyLine/);
  assert.doesNotMatch(doc, /export function mountScene/);
  assert.doesNotMatch(doc, /\| home\/home\.js, home\/home\.css, home\/scene3d\.js/);
});
