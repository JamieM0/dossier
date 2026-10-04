import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { featureVector, AXIS_KEYS, PERSONAL_LENS_45_CONFIG } from '@dossier/domain';
import { random, key } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/hard-v45-personal-lens.json';
const protocolPath='apps/dossier-cli/benchmarks/personal-lens-45-v1-protocol.json';
if(existsSync(fixturePath)||existsSync(protocolPath))throw new Error('Frozen personal-lens experiment exists; create another version.');
const source=JSON.parse(readFileSync('apps/dossier-cli/src/lab/hard-v1.json'));
const next=random(2026100345), items=[];
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
for(const domain of ['movies','books'])for(let index=0;index<48;index++) {
 const pool=items.filter(i=>i.domain===domain),tags=domain==='movies'?traits:bookTraits;
 const type=['tag','interaction','creator','decade','axis','unknown'][index%6];
 const eligibleAxes=AXIS_KEYS.filter(axis=>pool.filter(i=>i.features[axis]>=.35).length>=12&&pool.filter(i=>i.features[axis]<=-.35).length>=12);
 if(!eligibleAxes.length)throw new Error('No two-sided axis for fixture');
 const conditions=type==='tag'?[{kind:'tag',value:tags[0]}]:type==='interaction'?[{kind:'tag',value:tags[0]},{kind:'tag',value:tags[1]}]:
  type==='creator'?[{kind:domain==='movies'?'director':'creator',value:String(index%8+1)}]:type==='decade'?[{kind:'decade',value:String(1980+(index%5)*10)}]:
  type==='axis'?[{kind:'axis',value:eligibleAxes[index%eligibleAxes.length],side:Math.floor(index/6)%2?'high':'low'}]:[];
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
 if(!holdoutKeys.some(k=>ratings[k]>0)||!holdoutKeys.some(k=>ratings[k]<0))throw new Error('Synthetic holdout lacks both polarities');
 viewers.push({id:`lens45-${domain}-${index+1}`,domain,partition:index<24?'development':'sealed',type,
  rule:{conditions,effect},ratings,utilities,hidden,trainingKeys,holdoutKeys});
}
writeFileSync(fixturePath,JSON.stringify({version:'hard-v45-personal-lens',seed:2026100345,items,viewers})+'\n');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const old=JSON.parse(readFileSync('apps/dossier-cli/benchmarks/personal-lens-v1-protocol.json'));
const fixtures={...old.fixtures,lens4_regression:old.fixtures.synthetic};
delete fixtures.synthetic;
fixtures.synthetic={path:fixturePath,sha256:sha(fixturePath)};
const protocol={version:'personal-lens-45-v1',experiment:'4.5',
 hypothesis:'Broader supported-pattern questions improve discovery. Native and matched-strength existing-claim controls separate explicit feedback, score strength, and predicate language.',
 fixtures,generatorHash:sha('apps/dossier-cli/scripts/prepare-personal-lens-45.mjs'),
 arms:['inferred','narrow_personal','broad_personal','broad_shared','broad_native_claims','broad_authored_claims','broad_claims_equal_strength'],
 seeds:[11,29],ratings:40,maxPrompts:10,questionBudgets:[0,3,10],candidate:PERSONAL_LENS_45_CONFIG,
 privacy:old.privacy,bootstrap:old.bootstrap,
 questions:'Narrow repeats experiment 4. Broad questions use supported one- or two-predicate patterns across all rated items, require three supporting and three contrasting examples, and rank by smoothed polarity separation. No cosine eligibility gate. Each prompt offers one pattern. Retire pairs explained by accepted features. Rejected patterns do not imply absent metadata.',
 answers:'Synthetic people confirm exact predicates with matching polarity. Other represented rules answer none. Missing-factor synthetic people answer unknown. Recorded and earlier multi-rule people answer none because causal explanations are unavailable. All broad scoring arms share identical questions and answers.',
 controls:'Native existing claims confirm only matching already-inferred claims. Authored claims use the same existing language and native scoring but add missing claims from supplied evidence. Decades are unsupported. Native axes use 0.3 thresholds; personal axes use 0.35. Shared personal and equal-strength claim controls exclude decades and axes, retain identical feedback, and add 0.3 contributions capped at 0.6.',
 gates:{...old.gates,minimumCoverageGain:.1,minimumAttributionGain:.02,sharedScoreTolerance:.001},
 selection:'Broader discovery must improve represented-rule recovery over narrow questions by at least ten percentage points, recover at least 50 percent, improve AUC with positive lower bounds, preserve p10 within one point, beat 50 ratings, and preserve correction, removal, portability, and prompt safety in each fresh sealed domain. Shared personal and matched-strength claim scores must agree. A language-expansion claim additionally requires positive lower gains over native authored claims and the shared personal arm, with at least two AUC points over shared personal. Passing supports human confirmation only; no default change.',
 previousEvidence:'Experiment 4 viewers and catalogues were inspected. They provide regressions. Only 48 fresh reserved synthetic people support the new confirmation gates.',
 limits:[...old.limits,'Exact synthetic explanations cannot establish human benefit.','Threshold differences prevent clean axis attribution; shared controls exclude axes.','Native existing-claim availability can limit its control, so a native authored-claim arm tests the same language without the inference cutoff.','The study retains one main synthetic rule and does not establish robustness to misleading confirmations.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({version:protocol.version,viewers:viewers.length,items:items.length}));
