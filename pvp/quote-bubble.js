/** Padişah sözleri: sesli repliği olmayan dövüşçünün sözü (shared/padisahlar.js sozler) maçta ekranda yazı olarak görünür.
 * sound.js speak() çağrıldığında (sessizken de) showQuote(fighterId, key, text) gelir. DOM yoksa (Node/test) hiçbir şey yapmaz.
 * Stil: pvp/sound-fx.css (.pvp-quote). Tek şerit, yığılmaz: yeni söz eskisinin yerini alır.
 */
import {FIGHTERS} from './shared/fighters.js';

export const QUOTE_MS = Object.freeze({show: 2600, long: 4200, gapMs: 900});

let el = null, timer = null, lastAt = 0, lastKey = '';

function host() {
  const doc = globalThis.document;
  if (!doc?.createElement) return null;
  const root = doc.getElementById?.('pvp-root') || doc.body;
  if (!root) return null;
  if (el && el.isConnected) return el;
  el = doc.createElement('div');
  el.className = 'pvp-quote';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.hidden = true;
  root.appendChild(el);
  return el;
}

/** Saf: baloncuğun metni ("Ad: «söz»"). */
export function quoteText(fighterId, text) {
  const name = FIGHTERS[fighterId]?.name || '';
  return name ? `${name}: «${text}»` : `«${text}»`;
}

export function showQuote(fighterId, key, text) {
  if (!text) return false;
  const now = Date.now();
  const sig = fighterId + ':' + key;
  if (sig === lastKey && now - lastAt < QUOTE_MS.gapMs) return false; // aynı söz art arda gelmez
  const box = host();
  if (!box) return false;
  lastAt = now; lastKey = sig;
  const f = FIGHTERS[fighterId];
  box.style.setProperty('--q-main', f?.palette?.main || '#c99a12');
  box.style.setProperty('--q-accent', f?.palette?.accent || '#ffe08a');
  box.textContent = '';
  const doc = box.ownerDocument;
  const b = doc.createElement('b'); b.textContent = (f?.name || '') + ':';
  const q = doc.createElement('span'); q.textContent = ` «${text}»`;
  box.append(b, q);
  box.dataset.key = key;
  box.hidden = false;
  box.classList.remove('is-on'); void box.offsetWidth; box.classList.add('is-on');
  clearTimeout(timer);
  timer = setTimeout(() => { box.classList.remove('is-on'); box.hidden = true; }, key === 'soz' || key === 'zafer' ? QUOTE_MS.long : QUOTE_MS.show);
  return true;
}
