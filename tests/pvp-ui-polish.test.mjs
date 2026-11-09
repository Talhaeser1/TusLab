import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modePickerHTML} from '../pvp/arena-ui.js';
import {roundsPickerHTML} from '../pvp/rounds-ui.js';
import {networkConsoleHTML} from '../pvp/network.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('ana sayfadan üç PvP antrenman modu doğrudan açılır',()=>{
  const home=read('../app.js');
  for(const mode of ['classic','rounds','arena'])assert.match(home,new RegExp(`href="\\?pvp=practice&amp;mode=${mode}"`));
  assert.match(home,/data-action="pvp-enter">Çevrimiçi lobiyi aç/);
});

test('lobi eylemleri ve durum alanları açıklayıcıdır',()=>{
  const html=networkConsoleHTML();
  assert.match(html,/aria-controls="pvp-lobby-panel"/);
  assert.match(html,/id="pvp-lobby-panel"/);
  assert.match(html,/Seçili modda bot maçını başlat/);
  assert.match(html,/Davet bağlantısını kopyala/);
  assert.match(html,/data-lobby-log role="log" aria-live="polite"/);
  for(const mode of ['classic','rounds','arena'])assert.match(html,new RegExp(`data-mode="${mode}"`));
});

test('mod ve tur seçenekleri klavye ile erişilen düğmeler ve durum bildirimi kullanır',()=>{
  for(const html of [modePickerHTML('practice'),roundsPickerHTML('room')]){
    assert.match(html,/role="group" aria-labelledby=/);
    assert.match(html,/type="button"/);
    assert.match(html,/aria-pressed=/);
    assert.match(html,/title=/);
  }
  assert.match(read('../pvp/index.js'),/class="pvp-status-group" role="status"/);
});

test('yeni stiller en sonda yüklenir ve görünür odak sağlanır',()=>{
  const html=read('../index.html');
  assert.ok(html.indexOf('pvp/ui-polish.css')>html.indexOf('pvp/typing-top.css'));
  assert.ok(html.indexOf('ui-polish-home.css')>html.indexOf('pvp/ui-polish.css'));
  assert.match(read('../pvp/ui-polish.css'),/:focus-visible/);
  assert.match(read('../ui-polish-home.css'),/:focus-visible/);
});
