import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(import.meta.dirname,'..');
const dest=resolve(import.meta.dirname,'public');
/** Yayına girmeyecek kaynak klasörleri (testler de bu filtreyi doğrular):
 *  - assets/characters-src: ham KayKit kaynakları (~14 MB; oyun assets/characters/<id>.glb
 *    optimize kopyalarını kullanır, scripts/optimize-characters.mjs).
 *  - assets/higgsfield/deneme: sahne denemeleri.
 *  - assets/models/<ad>/kaynak: 3B model üretim arşivleri (paket 23: ham Meshy GLB'leri,
 *    örn. assets/models/vargr/kaynak ~4,6 MB; oyun optimize assets/models/<ad>/<ad>.glb kullanır). */
export const EXCLUDED_ASSETS=/[\\/]characters-src([\\/]|$)|[\\/]higgsfield[\\/]deneme([\\/]|$)|[\\/]models[\\/][^\\/]+[\\/]kaynak([\\/]|$)/;
export async function buildAssets(){
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
      // Yerel three.js (CSP yalnız 'self' script'e izin verir; CDN kullanılamaz).
      await cp(join(root,'pvp','vendor'),join(dest,'pvp','vendor'),{recursive:true});
    } else if(file==='assets'){
      await cp(join(root,file),join(dest,file),{recursive:true,filter:src=>!EXCLUDED_ASSETS.test(src)});
    } else await cp(join(root,file),join(dest,file),{recursive:true});
  }
  console.log('Cloudflare static assets prepared at:',dest);
}
const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) await buildAssets();
