import {
  cosineSimilarity, scoreCandidates, DEFAULT_SCORING_PARAMS,
  type TmdbItem, type RatingEntry, type Rating, type TasteClaim
} from '@dossier/domain';

export const QUESTION_POLICY_CONFIG = Object.freeze({
  ensemble: 6, representativeItems: 24, shortlist: 6,
  responsePrior: 0.5, recognitionPrior: 0.65, recognitionPriorWeight: 4,
  stabilityPenalty: 0.15, stopValue: 0.0005, stopAfterRatings: 10
});
export type QuestionPolicy = 'balanced_random' | 'disagreement' | 'counterfactual';
const ratings: Rating[] = [-3, -2, -1, 0, 1, 2, 3];
const key = (item: TmdbItem) => `${item.medium}:${item.id}`;
const params = { ...DEFAULT_SCORING_PARAMS, qualityWeight: 0, popularityBias: 0 };
const average = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
}
function shared(a: Pick<TmdbItem,'genres'>, b: Pick<TmdbItem,'genres'>): number {
  return a.genres.some(g=>b.genres.includes(g)) ? 1 : 0.25;
}
export function recognitionEstimate(item: TmdbItem, entries: RatingEntry[], skippedItems: TmdbItem[]): number {
  const yes = entries.reduce((s,e)=>s+shared(item,e.item),0);
  const no = skippedItems.reduce((s,e)=>s+shared(item,e),0);
  return (QUESTION_POLICY_CONFIG.recognitionPrior*QUESTION_POLICY_CONFIG.recognitionPriorWeight+yes)/
    (QUESTION_POLICY_CONFIG.recognitionPriorWeight+yes+no);
}
function responseProbabilities(item: TmdbItem, entries: RatingEntry[], neighbours?: Map<RatingEntry,number>): number[] {
  const weights = ratings.map(()=>QUESTION_POLICY_CONFIG.responsePrior);
  for (const entry of entries) {
    const index = ratings.indexOf(entry.rating);
    if (index >= 0) weights[index]! += (neighbours?.get(entry) ?? Math.exp(3*cosineSimilarity(item.features,entry.item.features)));
  }
  const total = weights.reduce((a,b)=>a+b,0);
  return weights.map(w=>w/total);
}
function scoreMap(items: TmdbItem[], entries: RatingEntry[], claims: readonly TasteClaim[]) {
  return new Map(scoreCandidates(items,entries,params,claims).map(row=>[key(row.item),row.score]));
}
function signPairs(items: TmdbItem[], scores: Map<string,number>): number[] {
  const pairs: number[] = [];
  for (let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++) {
    pairs.push(Math.sign((scores.get(key(items[i]!))??0)-(scores.get(key(items[j]!))??0)));
  }
  return pairs;
}
function uncertainty(signs: number[][], weights: number[]): number {
  if (!signs[0]?.length) return 0;
  return average(signs[0].map((_,pair)=>{
    const mean = signs.reduce((sum,row,i)=>sum+weights[i]!*row[pair]!,0);
    return signs.reduce((sum,row,i)=>sum+weights[i]!*row[pair]!**2,0)-mean**2;
  }));
}
function representative(items: TmdbItem[]): TmdbItem[] {
  const remaining = [...items].sort((a,b)=>key(a).localeCompare(key(b)));
  const selected: TmdbItem[] = [];
  if (remaining.length) selected.push(remaining.shift()!);
  const nearest = new Map(remaining.map(item=>[item,-Infinity]));
  while(remaining.length && selected.length<QUESTION_POLICY_CONFIG.representativeItems) {
    let best=0, distance=-Infinity;
    const latest=selected[selected.length-1]!;
    remaining.forEach((item,i)=>{
      const similarity=Math.max(nearest.get(item)!,cosineSimilarity(item.features,latest.features));
      nearest.set(item,similarity);
      const d=1-similarity;
      if(d>distance){distance=d;best=i;}
    });
    selected.push(remaining.splice(best,1)[0]!);
  }
  return selected;
}
export type ExperimentalQuestion = {
  item: TmdbItem; recognition: number; disagreement: number;
  predictedValue: number | null; stabilityRisk: number | null;
};

// Lab-only policies. No evaluator labels or public scores enter this API.
export function rankExperimentalQuestions(
  candidates: TmdbItem[], entries: RatingEntry[], claims: readonly TasteClaim[],
  skippedItems: TmdbItem[], policy: QuestionPolicy, seed: number, allowStop = true
): { questions: ExperimentalQuestion[]; stopped: boolean; uncertainty: number | null } {
  if (!candidates.length) return {questions:[],stopped:false,uncertainty:null};
  const next=random(seed), sorted=[...candidates].sort((a,b)=>key(a).localeCompare(key(b)));
  const randomRows=sorted.map(item=>({item,recognition:recognitionEstimate(item,entries,skippedItems),
    disagreement:0,predictedValue:null,stabilityRisk:null,priority:0}));
  randomRows.forEach(row=>{row.priority=-Math.log(Math.max(1e-12,next()))/row.recognition;});
  randomRows.sort((a,b)=>a.priority-b.priority || key(a.item).localeCompare(key(b.item)));
  if(policy==='balanced_random' || entries.length<5) return {questions:randomRows,stopped:false,uncertainty:null};
  const models=Array.from({length:QUESTION_POLICY_CONFIG.ensemble},()=>Array.from({length:entries.length},()=>entries[Math.floor(next()*entries.length)]!));
  const all=[...sorted,...entries.map(e=>({...e.item,overview:'',genreIds:[],voteCount:0,popularity:null,runtime:null} as TmdbItem))];
  const pool=representative(all), equal=models.map(()=>1/models.length);
  // Hold claims fixed in simulations, preserving explicit corrections and isolating rating geometry.
  const signs=models.map(model=>signPairs(pool,scoreMap(pool,model,claims)));
  const before=uncertainty(signs,equal);
  const rows=sorted.map(item=>{
    const neighbours=new Map(entries.map(entry=>[entry,Math.exp(3*cosineSimilarity(item.features,entry.item.features))]));
    const probabilities=models.map(model=>responseProbabilities(item,model,neighbours));
    const means=ratings.map((_,r)=>average(probabilities.map(p=>p[r]!)));
    const disagreement=average(ratings.map((_,r)=>average(probabilities.map(p=>(p[r]!-means[r]!)**2))));
    return {item,recognition:recognitionEstimate(item,entries,skippedItems),disagreement,
      predictedValue:null as number|null,stabilityRisk:null as number|null,probabilities,means};
  }).sort((a,b)=>b.disagreement*b.recognition-a.disagreement*a.recognition || key(a.item).localeCompare(key(b.item)));
  if(policy==='disagreement')return {questions:rows,stopped:false,uncertainty:before};
  const actual=signPairs(pool,scoreMap(pool,entries,claims));
  const stable=actual.map((sign,i)=>sign!==0&&signs.every(row=>row[i]===sign));
  const stableCount=stable.filter(Boolean).length;
  const shortlist=rows.slice(0,QUESTION_POLICY_CONFIG.shortlist);
  for(const row of shortlist) {
    let after=0,risk=0;
    ratings.forEach((rating,r)=>{
      const posterior=row.probabilities.map(p=>p[r]!/models.length/row.means[r]!);
      after+=row.means[r]!*uncertainty(signs,posterior);
      const hypothetical:RatingEntry={rating,ts:0,item:{...row.item,key:key(row.item)}};
      const updated=signPairs(pool,scoreMap(pool,[...entries,hypothetical],claims));
      const flips=updated.filter((sign,i)=>stable[i]&&sign!==actual[i]).length;
      risk+=row.means[r]!*(stableCount?flips/stableCount:0);
    });
    row.stabilityRisk=risk;
    row.predictedValue=row.recognition*(before-after-QUESTION_POLICY_CONFIG.stabilityPenalty*risk);
  }
  shortlist.sort((a,b)=>b.predictedValue!-a.predictedValue! || key(a.item).localeCompare(key(b.item)));
  const stopped=allowStop&&entries.length>=QUESTION_POLICY_CONFIG.stopAfterRatings&&shortlist[0]!.predictedValue!<=QUESTION_POLICY_CONFIG.stopValue;
  return {questions:stopped?[]:shortlist,stopped,uncertainty:before};
}
