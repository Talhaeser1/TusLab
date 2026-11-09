/** Pure local UI-preview typing metrics. Never writes authoritative match data. */
export function getTypingPreview(target, rawTyped, elapsedMs=0){
  if(typeof target!=='string'||typeof rawTyped!=='string')throw new TypeError('Expected text');
  const typed=rawTyped.slice(0,target.length);
  const count=typed.length;
  let correct=0;
  for(let i=0;i<count;i++)if(typed[i]===target[i])correct++;
  const prefixOk=target.startsWith(typed);
  const chain=prefixOk?(typed.match(/\S+\s+/gu)?.length??0):0;
  const wpm=elapsedMs>=2000&&count>=5?Math.round(correct/5/(elapsedMs/60000)):0;
  return {
    typed,count,total:target.length,correct,
    accuracy:count?Math.round(correct/count*100):null,
    percent:target.length?count/target.length:0,
    wpm,chain,finished:prefixOk&&count===target.length,
    ready:{Q:chain>=2,E:chain>=4,R:chain>=5}
  };
}
