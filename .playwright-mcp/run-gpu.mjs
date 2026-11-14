// Gerçek GPU ile (pencereli) ölçüm: run.mjs'in başlıklı sürümü.
// Kullanım: node .playwright-mcp/run.mjs <probe.js> '<json parametreler>'
import {createRequire} from 'node:module';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const cache = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const dir = readdirSync(cache).map(d => join(cache, d, 'node_modules', 'playwright')).find(existsSync);
if (!dir) { console.error('playwright bulunamadı'); process.exit(2); }
const {chromium} = createRequire(join(dir, 'package.json'))('playwright');

const [file, params = '{}'] = process.argv.slice(2);
const src = readFileSync(file, 'utf8').replace(/^\s*\/\/[^\n]*\n/, '');
const fn = (0, eval)(`(${src})`);
const browser = await chromium.launch({headless: false, args: ['--mute-audio', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-size=1400,900']});
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(p => { try { localStorage.setItem('__ui', p); } catch {} }, params);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5176/favicon.svg');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  const out = await fn(page);
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  if (errors.length) console.log('PAGEERRORS', JSON.stringify([...new Set(errors)].slice(0, 8)));
} finally { await browser.close(); }
