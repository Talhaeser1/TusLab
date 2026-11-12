// Raund arası ekranı: DOM ölçümü + ekran görüntüsü. {mode,w,h,tag}
async (page) => {
  const P = Object.assign({mode:'rounds',w:1366,h:768,tag:'x'}, JSON.parse(await page.evaluate(() => localStorage.getItem('__ui') || '{}')));
  await page.evaluate(() => { localStorage.setItem('tuslab-pvp-practice-round-style','counted'); localStorage.setItem('tuslab-pvp-practice-rounds','5'); });
  await page.setViewportSize({width:P.w,height:P.h});
  await page.goto(`http://127.0.0.1:5176/index.html?pvp=practice&mode=${P.mode}&bot=easy&karakter=vargr&fighter1=vargr&fighter2=nyx`);
  await page.waitForTimeout(P.mode==='arena'?4500:9500);
  const t0=Date.now(); let found=null;
  while(Date.now()-t0<200000){
    found=await page.evaluate(()=>{return [...document.querySelectorAll('.m33-result,.aui-summary')].some(e=>e.getBoundingClientRect().width>10)?1:0;});
    if(found)break;
    const w=await page.evaluate(()=>(document.querySelector('[data-tt-target]')?.textContent||'').trim());
    if(w&&w.length>1&&!/[✓…]/.test(w)){await page.keyboard.type(w,{delay:4});await page.keyboard.press('Space');}
    await page.waitForTimeout(60);
  }
  const measure=()=>page.evaluate(()=>{
    const W=innerWidth,H=innerHeight;
    const root=[...document.querySelectorAll('.m33-result,.aui-summary')].find(e=>e.getBoundingClientRect().width>10);
    const els=[...(root?root.querySelectorAll('*'):[])].filter(e=>e.getBoundingClientRect().width>0&&e.childElementCount===0&&(e.textContent||'').trim());
    const small=els.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>e.textContent.trim().slice(0,20));
    if(!root)return null;const rb=root?root.getBoundingClientRect():null;
    const over=els.filter(e=>{const r=e.getBoundingClientRect();return r.right>W+1||r.left<-1||r.bottom>H+1||r.top<-1}).map(e=>e.textContent.trim().slice(0,20));
    const h2=root?.querySelector('h2,.aui-sum-title');
    const ri=document.querySelector('.rui-inter:not([hidden])');const rr=ri&&ri.getBoundingClientRect();const cs=ri&&getComputedStyle(ri);return {inter:ri&&{cls:ri.className,box:[rr.left,rr.top,rr.right,rr.bottom].map(Math.round),pos:cs.position,bottom:cs.bottom,top:cs.top,maxH:cs.maxHeight,tf:cs.transform,vv:innerHeight,dock:getComputedStyle(document.querySelector('#pvp-root')).getPropertyValue('--rui-dock-bottom')},vp:W+'x'+H,title:h2?.textContent,titleFont:h2&&parseFloat(getComputedStyle(h2).fontSize),winner:root?.querySelector('.m33-winner')?.textContent,ko:!!root?.querySelector('.rui-ko'),box:rb&&[rb.left,rb.top,rb.right,rb.bottom].map(Math.round),small,over,hscroll:document.documentElement.scrollWidth>W+1,anim:root&&getComputedStyle(root).animationName};
  });
  const dbg=found?null:await page.evaluate(()=>({cls:document.querySelector('#pvp-root')?.className,url:location.href,txt:document.body.innerText.slice(0,200)}));
  let m=await measure();
  for(let i=0;i<40&&!m;i++){await page.waitForTimeout(250);m=await measure();}
  await page.waitForTimeout(500);const m2=await measure();if(m2)m=m2;
  await page.screenshot({path:`.playwright-mcp/raund-${P.mode}-${P.tag}.png`});
  return {found,...(m||{nomeasure:1,dbg})};
}
