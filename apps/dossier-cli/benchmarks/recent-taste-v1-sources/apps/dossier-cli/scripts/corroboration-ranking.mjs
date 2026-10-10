import { round } from './hard-metrics.mjs';
export function pairAccuracy(scores,truth,keys){
  let wins=0,pairs=0;
  for(const liked of keys)if(truth[liked]>0)for(const disliked of keys)if(truth[disliked]<0){
    const delta=(scores[liked]??0)-(scores[disliked]??0);wins+=delta>0?1:delta===0?.5:0;pairs++;
  }
  return round(pairs?wins/pairs:.5);
}
