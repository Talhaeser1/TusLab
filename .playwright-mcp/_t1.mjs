import {createMatch} from '../pvp/shared/match.js';
const pl=[{seat:1,playerId:'a',character:'fire'},{seat:2,playerId:'b',character:'rune'}];
for(const content of ['kelime','atasozu','siir','osmanlica']){
  for(let k=0;k<3;k++){
    const m=createMatch(pl,0,'id'+k,{rounds:5,roundStyle:'counted',content,seed:`id${k}:${Math.floor(Math.random()*2**32)}`});
    console.log(content,m.round.words.slice(0,5).join(' '));
  }
}
