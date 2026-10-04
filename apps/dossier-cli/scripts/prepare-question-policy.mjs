import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { random, key } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/hard-v3-questions.json';
const protocolPath='apps/dossier-cli/benchmarks/question-policy-v1-protocol.json';
if(existsSync(fixturePath)||existsSync(protocolPath))throw new Error('Frozen question experiment already exists; create a new version.');
const source=JSON.parse(readFileSync('apps/dossier-cli/src/lab/hard-v1.json'));
const next=random(2026100317);
const genres=[...new Set(source.items.flatMap(i=>i.genres))],tags=[...new Set(source.items.flatMap(i=>i.keywords))];
const quantise=u=>u>=2.4?3:u>=1.1?2:u>=.25?1:u<=-2.4?-3:u<=-1.1?-2:u<=-.25?-1:0;
const viewers=Array.from({length:72},(_,index)=>{
 const genreWeights=Object.fromEntries(genres.map(g=>[g,(next()-.5)*4]));
 const tagWeights=Object.fromEntries(tags.map(t=>[t,(next()-.5)*1.5]));
 const eraWeight=(next()-.5)*2,hiddenWeight=index%3===0?.9:.15;
 const recognitionWeights=Object.fromEntries(genres.map(g=>[g,.15+next()*.65]));
 const interaction=[tags[index%tags.length],tags[(index*7+3)%tags.length]];
 const utilities={},ratings={},contexts={},recognition={};
 for(const item of source.items){
  const id=key(item),latent=source.latent[id];
  let u=item.genres.reduce((s,g)=>s+genreWeights[g],0)+item.keywords.reduce((s,t)=>s+tagWeights[t],0);
  u+=eraWeight*(item.year-2002)/22+hiddenWeight*(latent.craft/5-1+(latent.sincere?.4:-.4));
  if(interaction.every(t=>item.keywords.includes(t)))u+=index%2?1:-1;
  u+=(((item.id*17+index*29)%101)/100-.5)*.12;
  utilities[id]=u;ratings[id]=quantise(u);contexts[id]={solo:u,social:u+(item.keywords.includes('action')?.7:-.2)};
  recognition[id]=Math.max(.1,Math.min(.95,item.genres.reduce((s,g)=>s+recognitionWeights[g],0)/Math.max(1,item.genres.length)+(item.year<2000?.1:0)));
 }
 return {id:`questions-v3-${index+1}`,partition:index<48?'development':'sealed',genreWeights,tagWeights,eraWeight,hiddenWeight,interaction,recognitionWeights,utilities,ratings,contexts,recognition};
});
writeFileSync(fixturePath,JSON.stringify({version:'hard-v3-questions',seed:2026100317,items:source.items,trainingKeys:source.trainingKeys,holdoutKeys:source.holdoutKeys,viewers})+'\n');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const paths={original:'real-tmdb-v1',confirmation:'new-viewers-v1',override:'override-viewers-v1',hard:'hard-v1',refine_regression:'hard-v2-refine',synthetic:'hard-v3-questions'};
const protocol={version:'question-policy-v1',hypothesis:'Rating questions should reduce whole-profile ranking uncertainty per interruption while protecting established taste.',
 fixtures:Object.fromEntries(Object.entries(paths).map(([cohort,name])=>[cohort,{path:`apps/dossier-cli/src/lab/${name}.json`,sha256:sha(`apps/dossier-cli/src/lab/${name}.json`)}])),generatorHash:sha('apps/dossier-cli/scripts/prepare-question-policy.mjs'),
 arms:['active','balanced_random','disagreement','counterfactual','counterfactual_no_stop'],seeds:[11,29],budgets:[5,10,20,40],maxPrompts:120,aucThreshold:.65,
 policy:{ensemble:6,representativeItems:24,shortlist:6,responsePrior:.5,recognitionPrior:.65,recognitionPriorWeight:4,stabilityPenalty:.15,stopValue:.0005,stopAfterRatings:10},
 recognition:'One deterministic Bernoulli draw per viewer, item, and session, shared across arms. The policy estimates recognition from observed ratings and skips only. Recorded training titles are all recognized; hard-v1 uses 0.65. No hidden rating can filter a question pool.',
 questionPool:'Only the training split. All policies see the same descriptive pool. Held-out items and outcomes stay outside selection.',
 simulation:'Bootstrap six rating histories with replacement. Predict seven rating responses from smoothed lens neighbours. Reweight ensemble profiles for each hypothetical response; estimate pair-order disagreement over 24 farthest-first training items. Penalize flips of unanimous established pair orders after appending each hypothetical rating. Hold claims fixed during simulations; actual CLI updates reconcile claims.',
 bootstrap:'Average both sessions within each viewer, then bootstrap viewers 5000 times. Report recorded, new synthetic development, new synthetic sealed, and prior synthetic cohorts separately.',
 gates:{positiveLowerBound:0,worstDecileMinimumDelta:0,stopMinimumPromptSaving:.2,stopAucNoninferiorityMargin:.005,maxSingleAnswerLoss:.05},
 selection:'Disagreement or counterfactual must beat balanced random with positive lower AUC bounds at 20 and 40 answers AND prompts, preserve worst-decile AUC, and limit single-answer loss. Pass separately on recorded and new sealed synthetic viewers. Stopping additionally needs 20% fewer prompts with terminal AUC noninferiority. No default change.',
 privacy:'Allowlist descriptive fields at the CLI catalogue boundary. Null public scores and popularity, omit utilities, contexts, recognition, latent preferences, and other-user data. Score with qualityWeight=0 and popularityBias=0.',
 geometry:'Current greedy geometry; experiments 1 and 2 rejected their candidates.',
 limits:['Recorded cohorts and hard-v2 were evaluated before; they are regressions.','New sealed viewers confirm synthetic behavior only; no independent human cohort.','Recorded data cannot measure recognition realistically because only already-rated titles have known answers.','Bootstrap uncertainty and predicted question value are proxies, not calibrated preference probabilities.','Counterfactual simulation conditions a finite ensemble rather than refitting every posterior profile; it holds claims fixed.','Context fields do not affect answers; this protocol uses solo preferences.','Ranking over fixed held-out items does not test catalogue retrieval.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({protocol:protocol.version,viewers:viewers.length}));
