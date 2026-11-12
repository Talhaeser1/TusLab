// Tempo ölçümünü üç modda + hızlı yazarda SIRAYLA (tek tarayıcı) çalıştırır.
// Kullanım: node .playwright-mcp/tempo-all.mjs <etiket> [mod,mod,...]
import {execFileSync} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
const tag = process.argv[2] || 'olcum';
const only = (process.argv[3] || '').split(',').filter(Boolean);
const runs = [
  ['rounds', {mode: 'rounds', maxMs: 95000}],
  ['classic', {mode: 'classic', maxMs: 75000}],
  ['arena', {mode: 'arena', maxMs: 75000}],
  ['classic-g120', {mode: 'classic', gap: 120, maxMs: 60000}],
].filter(([n]) => !only.length || only.includes(n));
mkdirSync('.playwright-mcp/tempo', {recursive: true});
for (const [name, p] of runs) {
  let out;
  try { out = execFileSync('node', ['.playwright-mcp/dovus-run.mjs', '.playwright-mcp/dovus-tempo.js', JSON.stringify(p)], {encoding: 'utf8', timeout: 240000, maxBuffer: 1 << 24}); }
  catch (e) { out = String(e.stdout || '') + '\nERR ' + String(e.message).slice(0, 300); }
  writeFileSync(`.playwright-mcp/tempo/${tag}-${name}.json`, out);
  console.log('== ' + name); console.log(out.slice(0, 2500));
}
