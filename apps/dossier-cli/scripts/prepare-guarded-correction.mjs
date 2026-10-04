import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { featureVector, CORRECTION_CONFIG, PROTECTION_CONFIG } from '@dossier/domain';
import { random, shuffled } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/guarded-correction-v1.json';
const protocolPath='apps/dossier-cli/benchmarks/guarded-correction-v1-protocol.json';
assert(!existsSync(fixturePath)&&!existsSync(protocolPath),'Create a new version instead of replacing frozen inputs');
const next=random(739281),genres=['Drama','Comedy','Action','Science Fiction'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief'];
const items=Array.from({length:144},(_,i)=>{
 const raw={id:7200000+i,medium:'movie',title:`Guarded catalogue ${i+1}`,year:1980+Math.floor(next()*45),posterPath:null,
  genres:[genres[Math.floor(next()*genres.length)]],genreIds:[],keywords:shuffled(tags,Math.floor(next()*100000)).slice(0,2),
  overview:'',runtime:80+Math.floor(next()*80),collection:null,directorIds:[1+Math.floor(next()*4)],creatorIds:[],
  voteAverage:null,voteCount:0,popularity:null};
 return {...raw,features:featureVector(raw)};
});
const keys=items.map(i=>`movie:${i.id}`),training=keys.slice(0,80),holdout=keys.slice(80);
const types=['multiple','noisy_explanations','partial_explanations','missing_factor','changing_taste','exceptions','persistent_noise','conflicting_evidence'];
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
 const rating=u=>u>.7?u>2?3:2:u<-.7?u< -2?-3:-2:0;
 const truth=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i))]));
 const old=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i,true))]));
 assert(holdout.some(k=>truth[k]>0)&&holdout.some(k=>truth[k]<0));
 viewers.push({id:`guarded-${partition}-${type}-${n}`,partition,type,seed,rules,
  trainingKeys:training,holdoutKeys:holdout,ratings:truth,oldRatings:old,
  responseNoise:['noisy_explanations','persistent_noise'].includes(type)?.25:0,abstention:type==='partial_explanations'?.5:0,
  followupNoise:['noisy_explanations','persistent_noise'].includes(type)?.25:0,persistent:type==='persistent_noise'});
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
writeFileSync(fixturePath,JSON.stringify({version:'guarded-correction-v1',items,viewers},null,2)+'\n');
const protocol={version:'guarded-correction-v1',experiment:'7',previousCommit:'041dd4c',
 fixture:{path:fixturePath,sha256:hash(readFileSync(fixturePath))},generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-guarded-correction.mjs')),
 arms:['current','bounded','scoped','guarded','reviewed'],candidate:CORRECTION_CONFIG,protection:PROTECTION_CONFIG,
 seeds:[17,43],ratings:40,maxPrompts:8,checkpoints:[0,4,8],confirmationViewers:80,totalViewers:160,
 cohort:'160 fresh synthetic people, 80 development and 80 reserved. Each partition has ten people in each of eight types; reserved people include three-rule combinations.',
 questions:'All policies receive a shared deterministic stream of up to eight broad questions. A review consumes one turn from the same eight-question budget. Follow-up answers can withdraw, defer, or apply a proposal; they cannot change ratings or propose new factors.',
 protectionMeaning:'Guarded leaves general proposals pending when fewer than four nonneutral matching ratings exist or at least one quarter contradict the effect. Reviewed asks a follow-up for such proposals and applies an explicit approval. Supported proposals apply directly. Exact title and pair controls use unchanged scoped priority.',
 actor:'Main noise follows experiment six. Follow-ups use a separate frozen RNG and can be wrong or unknown. Persistent-noise people always repeat their misleading main answer when asked again. Actor truth drives utterances only; no hidden ratings or rules reach a scorer, preview, or selector.',
 corrections:'General reversal trials use deliberate approval of both effects in the reviewed arm. Guarded cannot bypass its gate and any deferred reversal counts as failed control. All arms receive identical intentional title and pair reversals. Pending and withdrawn preferences must be visible and leave scores unchanged.',
 previews:'Preview returns supporting titles, counterexamples, reasons, and a signature tied to exact feedback and supplied ratings. Apply or withdraw is reversible. A changed proposal or rating evidence invalidates the approval.',
 gates:{minimumMeanGain:.02,worstDecileDelta:-.01,noisyMeanDelta:-.01,maxSinglePromptLoss:.05,minCorrectionRate:.9,minAnsweredViewers:.5,accurateGainRetention:.8},
 selection:'Only reserved people decide eligibility. All original gain, positive lower bound, worst decile, noisy subgroup, single-turn safety, control, locality, removal, restoration, portability, defaults, and overwrite gates remain required. Both noisy types need a lower gain bound of at least minus one point. Preserve at least 80 percent of scoped gain in the multiple group when scoped gain is positive. Passing earns review, never automatic promotion.',
 limitations:['Synthetic films and explanations only.','Known candidate ranking, not retrieval or human comprehension.','Reviews can repeat a wrong answer; simulated approval is not a measure of actual usability.','Title and pair feedback is diagnostic on rated films; unseen-film gains come from general feedback only.','Eight-turn limits include follow-ups; deferral can cost useful information.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({fixturePath,protocolPath,viewers:viewers.length}));
