// run.mjs ile aynı, ama gerçek GPU (ANGLE/D3D11) ile: yazılımsal GL'nin ~2 fps'si ölçümü bozmasın.
// Kullanım: node .playwright-mcp/run-gpu.mjs <probe.js> '<json parametreler>'
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
const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling']});
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(p => { try { localStorage.setItem('__ui', p); } catch {} }, params);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5176/favicon.svg');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
  const gl = await page.evaluate(() => { try { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return c.getParameter(d.UNMASKED_RENDERER_WEBGL); } catch (e) { return String(e); } });
  console.log('GL', gl);
  const out = await fn(page);
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  if (errors.length) console.log('PAGEERRORS', JSON.stringify([...new Set(errors)].slice(0, 8)));
} finally { await browser.close(); }
