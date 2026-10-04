import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { featureVector, CORRECTION_ARMS, CORRECTION_CONFIG } from '@dossier/domain';
import { random, shuffled } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/effective-correction-v1.json';
const protocolPath='apps/dossier-cli/benchmarks/effective-correction-v1-protocol.json';
assert(!existsSync(fixturePath)&&!existsSync(protocolPath),'Create a new version instead of replacing frozen inputs');
const next=random(624991),genres=['Drama','Comedy','Action','Science Fiction'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief'];
const items=Array.from({length:144},(_,i)=>{
 const raw={id:7100000+i,medium:'movie',title:`Correction catalogue ${i+1}`,year:1980+Math.floor(next()*45),posterPath:null,
  genres:[genres[Math.floor(next()*genres.length)]],genreIds:[],keywords:shuffled(tags,Math.floor(next()*100000)).slice(0,2),
  overview:'',runtime:80+Math.floor(next()*80),collection:null,directorIds:[1+Math.floor(next()*4)],creatorIds:[],
  voteAverage:null,voteCount:0,popularity:null};
 return {...raw,features:featureVector(raw)};
});
const keys=items.map(i=>`movie:${i.id}`),training=keys.slice(0,80),holdout=keys.slice(80);
const types=['multiple','noisy_explanations','partial_explanations','missing_factor','changing_taste','exceptions'];
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
  let score=type==='missing_factor'?craft[`movie:${item.id}`]*4:craft[`movie:${item.id}`]*1.3;
  if(type!=='missing_factor')rules.forEach((r,i)=>{if(matches(item,r))score+=r.effect*(old&&i===0?-1:1)*(i===0?2.3:1.5);});
  score+=.4*item.features.tone;
  if(type==='exceptions'&&special.has(`movie:${item.id}`))score=-score;
  return score;
 };
 const rating=u=>u>.7?u>2?3:2:u<-.7?u< -2?-3:-2:0;
 const truth=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i))]));
 const old=Object.fromEntries(items.map(i=>[`movie:${i.id}`,rating(utility(i,true))]));
 assert(holdout.some(k=>truth[k]>0)&&holdout.some(k=>truth[k]<0));
 viewers.push({id:`effective-${partition}-${type}-${n}`,partition,type,seed,rules,
  trainingKeys:training,holdoutKeys:holdout,ratings:truth,oldRatings:old,
  responseNoise:type==='noisy_explanations'?.25:0,abstention:type==='partial_explanations'?.5:0});
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
writeFileSync(fixturePath,JSON.stringify({version:'effective-correction-v1',items,viewers},null,2)+'\n');
const protocol={version:'effective-correction-v1',experiment:'6',preparationCommit:'669fc82',fixture:{path:fixturePath,sha256:hash(readFileSync(fixturePath))},
 generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-effective-correction.mjs')),arms:CORRECTION_ARMS,candidate:CORRECTION_CONFIG,
 seeds:[11,29],ratings:40,maxPrompts:8,checkpoints:[0,4,8],
 cohort:'120 synthetic movie people: 60 development and 60 reserved confirmation. Reserved people include unseen three-rule combinations.',
 privacy:'Only allowlisted public film metadata and revealed training ratings reach CLI actions. No public review scores, utilities, latent rules, or held-out ratings reach a scorer or question selector.',
 answers:'Reuse broad supported-pattern questions. Simulator confirms exact represented rules, sometimes gives misleading polarity or an unrelated rule, and sometimes abstains. Missing-factor people answer unknown. Same supplied answers for every arm.',
 scope:'General preference affects matching items. A title exception affects its exact key. A comparison affects its endpoints. Scoped priority is comparison, then exception, then most-specific general rule. Equal-specificity conflicts abstain. Latest feedback replaces the same target.',
 controls:'Current ignores experimental feedback. Native applies existing claim feedback and replaces title ratings through the current application transition; stored comparisons do not affect current scoring. Bounded adds 0.3 per general preference or exception with a combined 0.6 cap; comparisons add 0.3 to winner and subtract 0.3 from loser. Scoped replaces affected scores with signed priority 2 and a small within-scope baseline term. Comparisons enforce a 0.004 margin on an acyclic graph.',
 correction:'Diagnostic trials supply deliberate opposite feedback and require before-and-after ordering for direct pairs. General preferences require a signed score change; conflicting preferences must report ambiguity. General feedback does not promise every matching film beats every nonmatching film.',
 gates:{minimumMeanGain:.02,worstDecileDelta:-.01,noisyMeanDelta:-.01,maxSinglePromptLoss:.05,minCorrectionRate:.9,minAnsweredViewers:.5},
 selection:'Each candidate must pass every gate on reserved movie people. Gain needs a positive viewer-bootstrap lower bound; noisy subgroup lower bound must stay above -0.01. Control, removal, restoration, locality, portability, and unchanged product defaults must pass. Passing earns an adoption review using the synthetic lab and Jamie usability checks. No automatic promotion.',
 limitations:['Movie simulations only; no book product validation.','Known films only; retrieval remains outside the experiment.',
 'Synthetic explanations model a limited range of errors.','Source-pair correction trials diagnose control, not preference truth.',
 'Single-update losses are worst observations, not typical outcomes.','Evidence strength is not calibrated confidence.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({fixturePath,protocolPath,viewers:viewers.length}));
