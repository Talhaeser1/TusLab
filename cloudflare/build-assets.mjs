import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const dest=resolve(import.meta.dirname,'public');
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
const keep=['_headers','index.html','favicon.svg','app.js','arena-sound.js','styles.css','rogue.css','stage1.css','vibrant.css','phase1.css','phase2.css','phase3.css','layout-fixes.css','boss-extended.css','adventures.css','boss-motion.css','combat-feedback.css','exact-ui.css','arena-fire.css','ui-polish-home.css','visual-enrich.css','visual-enrich.js','assets','pvp'];
for(const file of keep){
  if(file==='pvp'){
    await mkdir(join(dest,'pvp'),{recursive:true});
    const files=await readdir(join(root,'pvp'));
    for(const child of files){
      if(child.endsWith('.js')||child.endsWith('.css'))await cp(join(root,'pvp',child),join(dest,'pvp',child));
    }
    // Shared match engine (also bundled into the Worker) — needed by the
    // browser-side offline practice mode (pvp/practice.js).
    await cp(join(root,'pvp','shared'),join(dest,'pvp','shared'),{recursive:true});
    // Yerel three.js (CSP yalnızca 'self' script'e izin verir; CDN kullanılamaz).
    await cp(join(root,'pvp','vendor'),join(dest,'pvp','vendor'),{recursive:true});
  } else if(file==='assets'){
    // Paket 32: ham karakter kaynakları (assets/characters-src, ~14 MB) yayına gitmez; oyun
    // assets/characters/<id>.glb optimize kopyalarını kullanır (scripts/optimize-characters.mjs).
    await cp(join(root,file),join(dest,file),{recursive:true,filter:src=>!/[\\/]characters-src([\\/]|$)/.test(src)});
  } else await cp(join(root,file),join(dest,file),{recursive:true});
}
console.log('Cloudflare static assets prepared at:',dest);
