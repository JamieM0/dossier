import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { featureVector, AXIS_KEYS, PERSONAL_LENS_CONFIG } from '@dossier/domain';
import { random, key, shuffled } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/hard-v4-personal-lens.json';
const protocolPath='apps/dossier-cli/benchmarks/personal-lens-v1-protocol.json';
if(existsSync(fixturePath)||existsSync(protocolPath))throw new Error('Frozen personal-lens experiment exists; create another version.');
const source=JSON.parse(readFileSync('apps/dossier-cli/src/lab/hard-v1.json'));
const next=random(2026100341), items=[];
const traits=['practical-effects','unreliable-narrator','ensemble-cast','episodic-form','regional-setting','ambiguous-resolution'];
const bookTraits=['epistolary-form','unreliable-narrator','ensemble-cast','episodic-form','regional-setting','ambiguous-resolution'];
for(const domain of ['movies','books']) {
 for(let block=0;block<60;block++) {
  const base=source.items[Math.floor(next()*source.items.length)];
  const features=domain==='movies'?featureVector(base):Object.fromEntries(AXIS_KEYS.map(a=>[a, (next()-.5)*1.8]));
  // Each block gives four metadata combinations with the same fixed representation.
  for(let variant=0;variant<4;variant++) {
   const id=(domain==='movies'?800000:900000)+block*4+variant;
   const keywords=(domain==='movies'?traits:bookTraits).filter((_,i)=> i<2 ? Boolean(variant&(1<<i)) : next()>.5);
   items.push({...base,id,medium:'movie',title:`${domain} specimen ${block+1}.${variant+1}`,domain,
    year:1980+block%5*10,genres:domain==='movies'?base.genres:[['Literary','Speculative','Mystery','Adventure'][block%4]],
    keywords,directorIds:domain==='movies'?[block%8+1]:[],creatorIds:domain==='books'?[block%8+1]:[],
    collection:null,features,voteAverage:null,voteCount:0,popularity:null});
  }
 }
}
const viewers=[];
for(const domain of ['movies','books'])for(let index=0;index<36;index++) {
 const pool=items.filter(i=>i.domain===domain),tags=domain==='movies'?traits:bookTraits;
 const type=['tag','interaction','creator','decade','axis','unknown'][index%6];
 const conditions=type==='tag'?[{kind:'tag',value:tags[0]}]:type==='interaction'?[{kind:'tag',value:tags[0]},{kind:'tag',value:tags[1]}]:
  type==='creator'?[{kind:domain==='movies'?'director':'creator',value:String(index%8+1)}]:type==='decade'?[{kind:'decade',value:String(1980+(index%5)*10)}]:
  type==='axis'?[{kind:'axis',value:AXIS_KEYS[index%10],side:Math.floor(index/6)%2?'high':'low'}]:[];
 const effect=Math.floor(index/6)%2?1:-1, utilities={},ratings={},hidden={};
 const match=item=>conditions.length>0&&conditions.every(p=>p.kind==='tag'?item.keywords.includes(p.value):p.kind==='director'?item.directorIds.includes(Number(p.value)):
  p.kind==='creator'?item.creatorIds.includes(Number(p.value)):p.kind==='decade'?String(Math.floor(item.year/10)*10)===p.value:
  p.side==='high'?item.features[p.value]>=.35:item.features[p.value]<=-.35);
 const axis=AXIS_KEYS[(index*3+2)%10];
 for(const item of pool) {
  const id=key(item),unobserved=(next()-.5)*2;
  hidden[id]=unobserved;
  const special=type==='unknown'?unobserved>0:match(item);
  const utility=effect*(special?1.65:-.75)+.45*item.features[axis]+(next()-.5)*.2;
  utilities[id]=utility;ratings[id]=utility>=1.3?2:utility>=.25?1:utility<=-1.3?-2:utility<=-.25?-1:0;
 }
 // Distinct held-out blocks prevent duplicated vectors crossing the split.
 const trainingKeys=pool.filter(i=>Math.floor((i.id%100000)/4)<40).map(key);
 const holdoutKeys=pool.filter(i=>Math.floor((i.id%100000)/4)>=40).map(key);
 viewers.push({id:`lens-${domain}-${index+1}`,domain,partition:index<24?'development':'sealed',type,
  rule:{conditions,effect},ratings,utilities,hidden,trainingKeys,holdoutKeys});
}
writeFileSync(fixturePath,JSON.stringify({version:'hard-v4-personal-lens',seed:2026100341,items,viewers})+'\n');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const paths={original:'real-tmdb-v1',confirmation:'new-viewers-v1',override:'override-viewers-v1',hard:'hard-v1',refine_regression:'hard-v2-refine',questions_regression:'hard-v3-questions',synthetic:'hard-v4-personal-lens'};
const protocol={version:'personal-lens-v1',hypothesis:'User-confirmed distinctions can repair fixed-lens collisions while preserving correction, portability, and honest uncertainty.',
 fixtures:Object.fromEntries(Object.entries(paths).map(([cohort,name])=>[cohort,{path:`apps/dossier-cli/src/lab/${name}.json`,sha256:sha(`apps/dossier-cli/src/lab/${name}.json`)}])),generatorHash:sha('apps/dossier-cli/scripts/prepare-personal-lens.mjs'),
 arms:['fixed','inferred','personal'],seeds:[11,29],ratings:40,questionBudgets:[0,3,10],maxPrompts:10,candidate:PERSONAL_LENS_CONFIG,
 privacy:'Allowlist descriptive metadata and fixed features at the CLI boundary. No public scores, other viewers, hidden rules, utility, domain labels, or held-out items enter question selection. qualityWeight=0 and popularityBias=0.',
 answers:'New synthetic users confirm only a shortlisted predicate identical to their hidden rule, with matching effect. Otherwise answer none. Prior viewers supply none: their recorded ratings do not reveal causal explanations. Never infer a human confirmation from a correlation.',
 controls:'Fixed excludes claims. Inferred retains current claims. Personal adds confirmed features to inferred. Compare ten distinction prompts against ten extra randomly selected training ratings. Unanswered/exhausted question budgets carry the terminal profile.',
 uncertainty:'Neighbour agreement and explicit features produce an uncalibrated confidence proxy. None caps confidence near the pair at 0.35. High-confidence errors are misordered positive-negative held-out pairs where both proxies are at least 0.8.',
 books:'Invented book metadata uses the same generic feature keys and predicate engine. The offline CLI movie identifier is a transport adapter, not a new product domain. Vectors are authored at generation; no film lens transforms them.',
 bootstrap:'Average two sessions per person, then bootstrap viewers 5000 times. Report each domain and partition independently; previous cohorts are regressions.',
 gates:{minimumGain:.02,worstDecileMinimumDelta:-.01,maxSinglePromptLoss:.05,correctionReversalRate:.9,minimumRuleRecovery:.5,minimumExplanationPrecision:.95,minimumConfidenceErrorReduction:0,minimumQuestionCoverage:.5},
 selection:'Pass gain (including positive lower bound), protection, sample efficiency, rule recovery, explanation precision, and high-confidence error gates separately on sealed movies and books. All correction, removal, limitation, and encrypted export checks must pass. Passing earns human confirmation only; never change defaults.',
 limits:['Synthetic confirmers have exact knowledge of one causal rule and no response noise.','Invented metadata collisions are a targeted stress test, not a representative catalogue.','No new human confirmation cohort; real users cannot supply causal rule labels.','Unknown preferences are absent from metadata and cannot be recovered.','Confidence is a proxy, not a probability.','Frozen-catalogue ranking does not test retrieval.','The generic rule language supports at most two predicates and a bounded additive contribution.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({version:protocol.version,viewers:viewers.length,items:items.length}));
