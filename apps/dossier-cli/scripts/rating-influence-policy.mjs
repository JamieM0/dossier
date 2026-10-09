import { cosineSimilarity, ratingWeight, tasteClaimScoreAdjustment, scoreCandidates, DEFAULT_SCORING_PARAMS } from '@dossier/domain';
import { key } from './hard-metrics.mjs';

export const INFLUENCE_ARMS=['current','local','local_recent','narrow_recent','exception_recent','additive_recent'];
export const INFLUENCE_CONFIG={prior:2,halfLifeDays:30,narrowPower:8,exceptionCosine:.85,exceptionMargin:.15,exceptionMass:1};

// Candidate inputs contain observed entries and public metadata only.
export function createInfluenceScorer(){
  const cache=new Map();
  const similarity=(a,b)=>{
    const id=[a.key??key(a),b.key??key(b)].sort().join('|');
    if(!cache.has(id))cache.set(id,Math.max(0,cosineSimilarity(a.features,b.features)));
    return cache.get(id);
  };
  const decay=(e,time)=>2**(-Math.max(0,time-e.ts)/(86400000*INFLUENCE_CONFIG.halfLifeDays));
  return (items,entries,claims,arm,time)=>{
    if(['current','local','local_recent'].includes(arm))return scoreCandidates(items,entries,DEFAULT_SCORING_PARAMS,claims,
      arm==='current'?{}:{localEvidence:arm==='local'?'timeless':'recent',referenceTime:time});
    if(!INFLUENCE_ARMS.includes(arm))throw new Error(`Unknown influence arm: ${arm}`);
    const ordered=entries.slice().sort((a,b)=>a.ts-b.ts||a.item.key.localeCompare(b.item.key));
    if(!ordered.some(e=>ratingWeight(e.rating)>0))return [];
    const exceptional=new Set();
    if(arm==='exception_recent')for(const [i,e]of ordered.entries()){
      let numerator=0,mass=0;
      for(const previous of ordered.slice(0,i)){
        const sim=similarity(e.item,previous.item);
        if(exceptional.has(previous.item.key)&&sim<INFLUENCE_CONFIG.exceptionCosine)continue;
        const w=sim**4*Math.abs(ratingWeight(previous.rating))*decay(previous,e.ts);
        numerator+=w*Math.sign(ratingWeight(previous.rating));mass+=w;
      }
      if(mass>=INFLUENCE_CONFIG.exceptionMass&&numerator/(INFLUENCE_CONFIG.prior+mass)*Math.sign(ratingWeight(e.rating)) < -INFLUENCE_CONFIG.exceptionMargin)
        exceptional.add(e.item.key);
    }
    return items.filter(item=>Object.values(item.features).some(v=>v!==0)).map(item=>{
      let numerator=0,denominator=INFLUENCE_CONFIG.prior;
      for(const entry of ordered){
        const sim=similarity(item,entry.item);
        if(exceptional.has(entry.item.key)&&sim<INFLUENCE_CONFIG.exceptionCosine)continue;
        const w=sim**(arm==='narrow_recent'?INFLUENCE_CONFIG.narrowPower:4)*Math.abs(ratingWeight(entry.rating))*decay(entry,time);
        numerator+=w*Math.sign(ratingWeight(entry.rating));denominator+=w;
      }
      const quality=item.voteAverage==null?0:(item.voteAverage/10-.5)*2;
      return {item,score:numerator/(arm==='additive_recent'?INFLUENCE_CONFIG.prior:denominator)+DEFAULT_SCORING_PARAMS.qualityWeight*quality+tasteClaimScoreAdjustment(item,claims)};
    }).sort((a,b)=>b.score-a.score);
  };
}
