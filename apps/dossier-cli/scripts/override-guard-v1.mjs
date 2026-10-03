import { deriveTasteClaims, scoreCandidates } from '@dossier/domain';
import { reviewsPlusTags } from './reviews-plus-tags-v1.mjs';
import { average, key, random, shuffled } from './hard-metrics.mjs';

// Only supplied ratings enter this rule. Candidate films and hidden answers cannot enter it.
export function dossierScores(candidates, entries) {
  return Object.fromEntries(scoreCandidates(candidates,entries,undefined,deriveTasteClaims(entries))
    .map(row=>[key(row.item),Math.round(row.score*1000)/1000]));
}
const quality = items=>Object.fromEntries(items.map(item=>[key(item),(item.voteAverage??0)/10]));
const preference = (scores,a,b)=>scores[a]>scores[b]?1:scores[a]<scores[b]?0:.5;
export function decideOverride(observed) {
  const positive=observed.filter(row=>row.rating>0),negative=observed.filter(row=>row.rating<0);
  const q=quality(observed.map(row=>row.item));
  const agreement=positive.length&&negative.length?average(positive.flatMap(a=>negative.map(b=>preference(q,key(a.item),key(b.item))))):.5;
  const base={useDossier:false,count:observed.length,likes:positive.length,dislikes:negative.length,publicAgreement:agreement};
  if(observed.length<20 || positive.length<6 || negative.length<6)return {...base,reason:'too_few_balanced_ratings'};
  if(agreement>.60)return {...base,reason:'public_reviews_not_clearly_misaligned'};
  const comparisons=[],repeatGains=[];
  for(const seed of [101,211,307]) {
    const assignments=new Map();
    for(const sign of [-1,0,1])shuffled(observed.filter(row=>Math.sign(row.rating)===sign).map(row=>key(row.item)),seed)
      .forEach((id,i)=>assignments.set(id,i%3));
    const own=[];
    for(let fold=0;fold<3;fold++) {
      const train=observed.filter(row=>assignments.get(key(row.item))!==fold);
      const validation=observed.filter(row=>assignments.get(key(row.item))===fold);
      const items=validation.map(row=>row.item),current=dossierScores(items,train),candidate=reviewsPlusTags(items,train);
      for(const a of validation.filter(row=>row.rating>0))for(const b of validation.filter(row=>row.rating<0)) {
        const good=key(a.item),bad=key(b.item);
        const pair={good,bad,current:preference(current,good,bad),candidate:preference(candidate,good,bad),publicReviews:preference(q,good,bad)};
        own.push(pair);comparisons.push(pair);
      }
    }
    repeatGains.push({seed,candidate:average(own.map(p=>p.current-p.candidate)),publicReviews:average(own.map(p=>p.current-p.publicReviews)),pairs:own.length});
  }
  // Resample titles, not repeated folds or correlated title pairs, for the uncertainty check.
  const next=random(907),draws={candidate:[],publicReviews:[]};
  const resample=rows=>{
    const counts=new Map();
    for(let i=0;i<rows.length;i++){const id=key(rows[Math.floor(next()*rows.length)].item);counts.set(id,(counts.get(id)??0)+1);}
    return counts;
  };
  for(let iteration=0;iteration<1000;iteration++) {
    const good=resample(positive),bad=resample(negative);
    let denom=0,sums={candidate:0,publicReviews:0};
    for(const p of comparisons){const w=(good.get(p.good)??0)*(bad.get(p.bad)??0);denom+=w;for(const m of Object.keys(sums))sums[m]+=w*(p.current-p[m]);}
    for(const m of Object.keys(sums))draws[m].push(denom?sums[m]/denom:0);
  }
  const lower=Object.fromEntries(Object.entries(draws).map(([m,v])=>[m,v.sort((a,b)=>a-b)[25]]));
  const stable=repeatGains.every(row=>row.candidate>=.05 && row.publicReviews>=.05);
  const supported=lower.candidate>0 && lower.publicReviews>0;
  return {...base,useDossier:stable&&supported,reason:stable&&supported?'repeatable_observed_advantage':'advantage_not_reliable',repeatGains,lower,comparisons};
}
