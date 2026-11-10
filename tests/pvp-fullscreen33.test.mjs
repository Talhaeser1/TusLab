import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('pvp/index.js');
const css = read('pvp/fullscreen33.css');
const compact = read('pvp/compact-height.css');
const scope = '#pvp-root[data-layout="fullscreen"]';
const blocks = text => [...text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const rule = (text, selector) => blocks(text).find(([, selectors]) => selectors.split(',').some(item => item.trim() === selector))?.[2] || '';
function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}

test('B1 fullscreen layout follows running/paused matches with either arena and clears outside matches', () => {
  let arena = {};
  const root = {hidden: false, dataset: {}, querySelector: () => arena};
  const network = {match: null};
  const sync = runInNewContext(`(${declaration('fullscreenLayoutSync')})`, {root, network});
  for (const renderer of ['2d', '3d']) {
    for (const status of ['running', 'paused']) {
      arena = {renderer};
      network.match = {status};
      sync();
      assert.equal(root.dataset.layout, 'fullscreen', `${renderer} ${status}`);
    }
  }
  for (const match of [null, {status: 'waiting'}, {status: 'countdown'}, {status: 'ended'}]) {
    root.dataset.layout = 'fullscreen';
    network.match = match;
    sync();
    assert.equal(Object.hasOwn(root.dataset, 'layout'), false);
  }
  network.match = {status: 'running'};
  arena = null;
  sync();
  assert.equal(Object.hasOwn(root.dataset, 'layout'), false, 'arena absent');
  arena = {};
  root.hidden = true;
  root.dataset.layout = 'fullscreen';
  sync();
  assert.equal(Object.hasOwn(root.dataset, 'layout'), false, 'root closed');
  assert.match(source, /root\.dataset\.layout\s*=\s*'fullscreen'/);
  assert.match(source, /delete root\.dataset\.layout/);
  assert.match(source, /addEventListener\('tuslab:pvp-match',\s*fullscreenLayoutSync\)/);
  assert.match(source, /arenaLayoutSync\(\);fullscreenLayoutSync\(\)/, 'initial screen synchronized');
  assert.match(source, /delete root\.dataset\.layout;\s*delete root\.dataset\.pvpMode/, 'closing screen clears attribute');
});

test('B3 fullscreen duel covers viewport, HP stays above stage and only the right graphics are mirrored', () => {
  const duel = rule(css, `${scope} .pvp2-duel`);
  assert.match(duel, /position:\s*fixed/);
  assert.match(duel, /inset:\s*0/);
  assert.match(duel, /z-index:\s*0/);
  assert.match(duel, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rule(css, `${scope} .pvp2-side>.pvp2-health`), /grid-row:\s*1/);
  assert.match(rule(css, `${scope} .pvp2-side>.pvp2-player-top`), /grid-row:\s*1/);
  assert.match(rule(css, `${scope} .pvp2-health-track`), /height:\s*28px/);
  assert.match(rule(css, `${scope} .pvp2-rune .pvp2-health-track`), /transform:\s*scaleX\(-1\)/);
  assert.match(rule(css, `${scope} .pvp2-health-track>.pvp2-health-fill`), /transform-origin:\s*left center/);
  assert.doesNotMatch(rule(css, `${scope} .pvp2-rune .pvp2-health-meta`), /scaleX/);
  assert.match(rule(css, `${scope} .pvp-topbar-clock`), /left:\s*50%/);
  assert.match(rule(css, `${scope} .pvp2-toolbar`), /height:\s*40px/);
});

test('B4/B5 typing panel is opaque bottom-center, target is at least 28px and four skills fit a 48px row', () => {
  const panel = rule(css, `${scope} .pvp2-shell>.tt`);
  assert.match(panel, /position:\s*fixed/);
  assert.match(panel, /bottom:/);
  assert.match(panel, /left:\s*50%/);
  assert.match(panel, /translate:\s*-50% 0/, 'horizontal centering survives typeTopMove vertical transforms');
  assert.match(panel, /width:\s*min\(760px,\s*92vw\)/);
  assert.match(panel, /background:\s*#[0-9a-f]{6}\s*[;}]/i);
  assert.match(rule(css, `${scope} .tt-target`), /font-size:\s*clamp\(28px,/);
  assert.match(rule(css, `${scope} .pvp2-side>.pvp2-skillrow`), /bottom:/);
  assert.match(rule(css, `${scope} .pvp2-skillrow`), /repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rule(css, `${scope} .sk-card`), /height:\s*48px/);
  for (const [, selectors, body] of blocks(css)) {
    if (selectors.includes('.fhud-super') || selectors.includes('.fhud-assist')) {
      assert.ok(body.split(';').filter(item => item.trim()).every(item => /^\s*(top|left|right|bottom):/.test(item)), 'fight HUD changes only positional edges');
    }
  }
});

test('B6 compact overrides include short screens and a phone stack with a shared stage of at least 40vh', () => {
  const fullscreen = compact.slice(compact.indexOf('/* Paket 33'));
  assert.match(fullscreen, /@media\s*\(max-height:\s*760px\)/);
  assert.match(fullscreen, /@media\s*\(max-width:\s*600px\)/);
  const phone = fullscreen.slice(fullscreen.indexOf('@media (max-width:600px)'));
  assert.match(rule(phone, `${scope} .pvp2-side`), /display:\s*contents/);
  assert.match(rule(phone, `${scope} .pvp2-side>.pvp2-stage`), /min-height:\s*40vh/);
  assert.match(rule(phone, `${scope} .pvp2-rune>.pvp2-health`), /top:\s*120px/);
  const html = read('index.html');
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  assert.match(styles.at(-1)[0], /pvp\/compact-height\.css/);
});

test('B7 fullscreen CSS is scoped, has no blur or fonts below 12px, and keeps focus and reduced motion', () => {
  assert.doesNotMatch(css, /backdrop-filter|blur\s*\(/i);
  for (const [, selectors, body] of blocks(css)) {
    for (const selector of selectors.split(/,(?![^()]*\))/)) {
      assert.ok(selector.trim().startsWith(scope), `unscoped selector: ${selector}`);
    }
    for (const [, value] of body.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      assert.ok(Number(value) >= 12, `font-size ${value}px`);
    }
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /#pvp-root\[data-layout="fullscreen"\]\.pvp4-reduced/);
});

test('B2 Fullscreen API uses the PvP root, handles exit/Escape, hides unavailable control and catches rejection', async () => {
  const button = {hidden: false, textContent: '', setAttribute(key, value) { this[key] = value; }};
  let requests = 0, exits = 0;
  const root = {querySelector: () => button, requestFullscreen: async () => { requests++; }};
  const document = {fullscreenEnabled: false, fullscreenElement: null, exitFullscreen: async () => { exits++; }};
  const sync = runInNewContext(`(${declaration('fullscreenButtonSync')})`, {root, document});
  sync();
  assert.equal(button.hidden, true);
  document.fullscreenEnabled = true;
  sync();
  assert.equal(button.hidden, false);
  assert.equal(button['aria-pressed'], 'false');
  assert.equal(button.textContent, '⛶ Tam ekran');
  document.fullscreenElement = {};
  sync();
  assert.equal(button['aria-pressed'], 'false', 'another element is fullscreen');
  document.fullscreenElement = root;
  sync();
  assert.equal(button['aria-pressed'], 'true');
  assert.equal(button.textContent, '⛶ Tam ekrandan çık');
  document.fullscreenElement = null;
  sync();
  assert.equal(button['aria-pressed'], 'false', 'Escape updates control');
  assert.match(source, /document\.addEventListener\('fullscreenchange',fullscreenButtonSync\)/);
  assert.match(source, /class="pvp4-toggle" data-pvp-action="fullscreen"/);
  const clickBody = source.match(/else if\(action\.dataset\.pvpAction==='fullscreen'\)\{([\s\S]*?)\n  \} else if/)[1];
  const click = runInNewContext(`(async () => {${clickBody}})`, {root, document, fullscreenButtonSync: sync});
  await click();
  assert.equal(requests, 1);
  document.fullscreenElement = root;
  await click();
  assert.equal(exits, 1);
  document.fullscreenElement = null;
  root.requestFullscreen = () => Promise.reject(new Error('denied'));
  await click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(button['aria-pressed'], 'false');
});
