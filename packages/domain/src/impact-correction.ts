import { scoreCorrections, type CorrectionState } from './effective-correction.js';
import { protectedFeedback, type CorrectionReviews } from './protected-correction.js';
import { matchesLensRule } from './personal-lens.js';
import type { RatingEntry, TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const IMPACT_ARMS = ['impact_guarded','impact_reviewed','impact_ranked'] as const;
export type ImpactArm = typeof IMPACT_ARMS[number];
export const IMPACT_CONFIG = { relativeStrength:.1, minimumScale:.001, maximumChangedRelations:3, maximumHalvings:24 } as const;
const key = (item: TmdbItem) => `${item.medium}:${item.id}`;
const published = (score: number) => Math.round(score*1000)/1000 || 0;
export function impactScale(scores: number[]) {
  const ordered = [...scores].sort((a,b)=>a-b);
  const q = (p:number) => ordered[Math.floor((ordered.length-1)*p)] ?? 0;
  return Math.max(IMPACT_CONFIG.minimumScale,q(.75)-q(.25));
}
export function changedRelations(before: number[], after: number[]) {
  const counts = before.map(()=>0),visibleBefore=before.map(published),visibleAfter=after.map(published);
  for(let i=0;i<before.length;i++)for(let j=i+1;j<before.length;j++) {
    const raw = Math.sign(before[i]!-before[j]!) !== Math.sign(after[i]!-after[j]!);
    const visible = Math.sign(visibleBefore[i]!-visibleBefore[j]!) !== Math.sign(visibleAfter[i]!-visibleAfter[j]!);
    if(raw||visible){counts[i]!++;counts[j]!++;}
  }
  return counts;
}
export function scoreImpactCorrections(candidates:TmdbItem[],entries:RatingEntry[],claims:readonly TasteClaim[],state:CorrectionState,reviews:CorrectionReviews,arm:ImpactArm) {
  const active = protectedFeedback(state,entries,reviews,arm==='impact_guarded'?'guarded':'reviewed');
  const baseline = scoreCorrections(candidates,entries,claims,{version:1,feedback:[]},'current');
  const scale = impactScale(baseline.map(r=>r.score)),strength = scale*IMPACT_CONFIG.relativeStrength;
  const general = active.state.feedback.filter(f=>f.kind==='general');
  const effects = baseline.map(r=>{
    const matches = general.filter(f=>matchesLensRule(r.item,f.conditions));
    const specificity = Math.max(0,...matches.map(f=>f.conditions.length));
    const chosen = matches.filter(f=>f.conditions.length===specificity),signs=new Set(chosen.map(f=>f.effect));
    return {delta:signs.size===1?chosen[0]!.effect*strength:0,applied:signs.size===1?chosen.map(f=>f.id):[],conflicts:signs.size>1?chosen.map(f=>f.id):[]};
  });
  const exceptions = active.state.feedback.filter(f=>f.kind==='exception');
  const exact = new Map<string,number>((exceptions.length?scoreCorrections(candidates,entries,claims,{version:1,feedback:exceptions},'scoped'):baseline).map(r=>[key(r.item),r.score] as const));
  const index = new Map<string,number>(baseline.map((r,i)=>[key(r.item),i] as const));
  const pairs = active.state.feedback.filter(f=>f.kind==='comparison').filter(f=>index.has(f.winner)&&index.has(f.loser));
  const graph = new Map<string,string[]>();
  for(const f of pairs)graph.set(f.winner,[...(graph.get(f.winner)??[]),f.loser]);
  const visiting=new Set<string>(),visited=new Set<string>();
  const cycle=(id:string):boolean=>{
    if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);
    for(const next of graph.get(id)??[])if(cycle(next))return true;
    visiting.delete(id);visited.add(id);return false;
  };
  const cyclic=[...graph.keys()].some(cycle);
  const narrow=(scores:number[])=>{
    const result=[...scores];
    for(const f of exceptions){const i=index.get(f.key);if(i!==undefined)result[i]=exact.get(f.key)!;}
    if(!cyclic){const solved=new Set<string>();
      const satisfy=(id:string):void=>{if(solved.has(id))return;for(const loser of graph.get(id)??[]){satisfy(loser);const i=index.get(id)!,j=index.get(loser)!;result[i]=Math.max(result[i]!,result[j]!+.004);}solved.add(id);};
      for(const id of [...graph.keys()].sort())satisfy(id);
    }
    return result;
  };
  const reference=narrow(baseline.map(r=>r.score));
  const calculate=(fraction:number)=>narrow(baseline.map((r,i)=>r.score+effects[i]!.delta*fraction));
  let fraction=1,scores=calculate(fraction);
  if(arm==='impact_ranked'){
    let attempts=0;
    while(changedRelations(reference,scores).some(n=>n>IMPACT_CONFIG.maximumChangedRelations)&&attempts<IMPACT_CONFIG.maximumHalvings){fraction/=2;scores=calculate(fraction);attempts++;}
    if(changedRelations(reference,scores).some(n=>n>IMPACT_CONFIG.maximumChangedRelations)){fraction=0;scores=reference;}
  }
  const relations=changedRelations(reference,scores);
  return baseline.map((r,i)=>{
    const id=key(r.item),exception=exceptions.find(f=>f.key===id),pairIds=pairs.filter(f=>f.winner===id||f.loser===id).map(f=>f.id);
    const applied=exception?[exception.id]:fraction>0?effects[i]!.applied:[];
    return {...r,score:scores[i]!,correctionEvidence:{applied:applied.concat(cyclic?[]:pairIds),
      conflicts:effects[i]!.conflicts.concat(cyclic?pairIds:[]),confidence:null,
      reviews:active.decisions.map(d=>({id:d.id,status:d.status,reasons:d.reasons,reviewed:d.reviewed})),
      impact:{scale,maximumGeneralDelta:strength,fraction,changedRelations:relations[i]!,limited:fraction<1,generalDelta:exception?0:effects[i]!.delta*fraction}
    }};
  }).sort((a,b)=>b.score-a.score||key(a.item).localeCompare(key(b.item)));
}
