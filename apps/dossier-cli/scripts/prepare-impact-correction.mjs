import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { featureVector, CORRECTION_CONFIG, PROTECTION_CONFIG, IMPACT_CONFIG } from '@dossier/domain';
import { random, shuffled } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/impact-correction-v1.json';
const protocolPath='apps/dossier-cli/benchmarks/impact-correction-v1-protocol.json';
assert(!existsSync(fixturePath)&&!existsSync(protocolPath),'Create a new version instead of replacing frozen inputs');
const next=random(849331),genres=['Drama','Comedy','Action','Science Fiction'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief'];
const items=Array.from({length:200},(_,i)=>{
 const raw={id:7300000+i,medium:'movie',title:`Impact catalogue ${i+1}`,year:1980+Math.floor(next()*45),posterPath:null,
  genres:[genres[Math.floor(next()*genres.length)]],genreIds:[],keywords:shuffled(tags,Math.floor(next()*100000)).slice(0,2),
  overview:'',runtime:80+Math.floor(next()*80),collection:null,directorIds:[1+Math.floor(next()*4)],creatorIds:[],
  voteAverage:null,voteCount:0,popularity:null};
 return {...raw,features:featureVector(raw)};
});
const keys=items.map(i=>`movie:${i.id}`),training=keys.slice(0,120),holdout=keys.slice(120);
const types=['multiple','noisy_explanations','partial_explanations','missing_factor','changing_taste','exceptions','persistent_noise','conflicting_evidence','consistent_misleading','weak_ratings'];
const matches=(item,rule)=>rule.conditions.every(p=>p.kind==='tag'?item.keywords.includes(p.value):item.genres.includes(p.value));
const viewers=[];
for(const partition of ['development','sealed'])for(const type of types)for(let n=0;n<10;n++) {
 const seed=Math.floor(next()*10000000),rng=random(seed);
 const rules=[{conditions:[{kind:'tag',value:tags[Math.floor(rng()*tags.length)]}],effect:rng()<.5?-1:1},
  {conditions:[{kind:'genre',value:genres[Math.floor(rng()*genres.length)]}],effect:rng()<.5?-1:1}];
 if(partition==='sealed')rules.push({conditions:[{kind:'tag',value:tags[(tags.indexOf(rules[0].conditions[0].value)+3)%tags.length]},
  {kind:'genre',value:genres[(genres.indexOf(rules[1].conditions[0].value)+1)%genres.length]}],effect:rng()<.5?-1:1});
 const craft=Object.fromEntries(keys.map(k=>[k,rng()*2-1]));
 const special=new Set(shuffled(keys,seed+719).slice(0,10));
 const utility=(item,old=false)=>{
  let score=type==='missing_factor'?craft[`movie:${item.id}`]*4:craft[`movie:${item.id}`]*(type==='conflicting_evidence'?3.5:1.3);
  if(type!=='missing_factor')rules.forEach((r,i)=>{if(matches(item,r))score+=r.effect*(old&&i===0?-1:1)*(i===0?2.3:1.5);});
  score+=.4*item.features.tone;
  if(type==='exceptions'&&special.has(`movie:${item.id}`))score=-score;
  return score;
 };
 const rating=u=>u>.7?(type==='weak_ratings'?1:u>2?3:2):u<-.7?(type==='weak_ratings'?-1:u< -2?-3:-2):0;
 const truth=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i))]));
 const old=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i,true))]));
 assert(holdout.some(k=>truth[k]>0)&&holdout.some(k=>truth[k]<0));
 let trainingKeys=training;
 if(type==='consistent_misleading') {
  const order=shuffled(training,seed+937),itemByKey=new Map(items.map(i=>[`movie:${i.id}`,i]));
  const preferred=order.filter(k=>(itemByKey.get(k).features.tone>=.35&&truth[k]<0)||(itemByKey.get(k).features.tone<.35&&truth[k]>0));
  trainingKeys=[...preferred,...order.filter(k=>!preferred.includes(k))].slice(0,40);
 }
 viewers.push({id:`impact-${partition}-${type}-${n}`,partition,type,seed,rules,
  trainingKeys,holdoutKeys:holdout,ratings:truth,oldRatings:old,
  responseNoise:['noisy_explanations','persistent_noise'].includes(type)?.25:0,abstention:type==='partial_explanations'?.5:0,
  followupNoise:['noisy_explanations','persistent_noise'].includes(type)?.25:0,persistent:['persistent_noise','consistent_misleading'].includes(type)});
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
writeFileSync(fixturePath,JSON.stringify({version:'impact-correction-v1',items,viewers},null,2)+'\n');
const protocol={version:'impact-correction-v1',experiment:'8',previousCommit:'e4b7289',
 fixture:{path:fixturePath,sha256:hash(readFileSync(fixturePath))},generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-impact-correction.mjs')),
 arms:['current','scoped','guarded','reviewed','impact_guarded','impact_reviewed','impact_ranked'],candidate:CORRECTION_CONFIG,protection:PROTECTION_CONFIG,impact:IMPACT_CONFIG,
 seeds:[23,59],ratings:40,maxPrompts:8,checkpoints:[0,4,8],confirmationViewers:100,totalViewers:200,
 cohort:'200 fresh synthetic people and 200 fresh films; 100 development and 100 reserved. Ten taste types per partition, ten people per type. Reserved preferences include additional three-rule combinations. Eighty films per person remain hidden.',
 questions:'Shared broad-question stream, at most eight actual questions per policy. Follow-ups consume the same budget. New reviewed candidates follow the same review schedule as the reviewed control; approval never removes a score or relation limit.',
 limits:'Score-limited candidates use one signed contribution of 10 percent of baseline interquartile spread, with a minimum scale of 0.001. The most specific active general preference wins; conflicting equally specific rules abstain. Contributions cannot stack. The ranked candidate halves all broad contributions until each film changes at most three raw or published score relations, then uses zero if needed after 24 halvings. Rank checks include consequences through existing narrow comparisons, against a baseline with those comparisons intact.',
 narrow:'Title exceptions and direct comparisons retain original scoped authority. Those explicit narrow changes do not count against the broad budget. Cycles expose conflicts. Removing feedback and restoring original feedback must restore scores exactly. Locality trials include reversals within populated multi-preference profiles.',
 actor:'Existing noise, partial, drift, exception, missing-factor, and conflicting-evidence types remain. A consistent-misleading type supplies a biased forty-film library favoring high-tone dislikes and lower-tone likes, then confirms unrelated axis descriptions and repeats them during review. Weak-rating people use plus or minus one without changing underlying preferences. No private truth or future ratings reach the model or selector.',
 publication:'The CLI publishes scores rounded to three decimals. Ranking-limit checks include both raw and published pair relations. General direction trials use published score changes; numerical changes that disappear in the CLI count as ineffective correction.',
 corrections:'Reviewed and both reviewed impact candidates deliberately approve both general effects in reversal trials. Guarded candidates receive no bypass. All candidates receive identical title and pair reversals. Eight-question quality paths never receive diagnostic feedback.',
 gates:{minimumMeanGain:.02,worstDecileDelta:-.01,noisyMeanDelta:-.01,maxSinglePromptLoss:.05,minCorrectionRate:.9,minAnsweredViewers:.5,accurateGainRetention:.8},
 selection:'Reserved people only. Preserve every prior gain, uncertainty, worst-decile, five-point single-answer loss, coverage, 90-percent correction, locality, pending, reversibility, portability, default, and overwrite requirement. Both noisy groups and the consistent-misleading group need lower gain bounds of at least minus one point. Preserve at least 80 percent of scoped gain for accurate multiple preferences when positive. New candidates must obey their declared broad limits. Passing earns adoption review; no automatic default changes.',
 limitations:['Known synthetic film candidates only; no retrieval or human comprehension test.','A limit on changed relations does not guarantee a five-point accuracy loss for every possible hidden label distribution.','Candidate-pool composition affects the spread and relation budget; portability compares identical pools.','General direction can fail when a cap blocks a change or score publication hides it.','Narrow feedback is tested on rated diagnostic titles; unseen-film quality paths use general feedback only.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({fixturePath,protocolPath,viewers:viewers.length}));
