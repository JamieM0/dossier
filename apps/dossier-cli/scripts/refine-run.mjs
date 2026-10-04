import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { featureVector, cosineSimilarity, REFINE_METRIC_CONFIG, buildTasteSpace, learnRefineMetric } from '@dossier/domain';
import { execute } from '../dist/actions.js';
import { assess, average, distribution, key, round, shuffled } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
const argv = process.argv.slice(2);
const value = (flag,fallback) => argv.includes(flag) ? argv[argv.indexOf(flag)+1] : fallback;
const maxViewers = Number(value('--max-viewers','0'));
const output = value('--output','reports/refine-signal-v1.json');
if (!Number.isSafeInteger(maxViewers) || maxViewers < 0) throw new Error('Invalid max-viewers');
if (value('--protocol','refine-signal-v1') !== 'refine-signal-v1') throw new Error('Unknown protocol');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protocolBytes = readFileSync('apps/dossier-cli/benchmarks/refine-signal-v1-protocol.json');
const protocol = JSON.parse(protocolBytes);
if (JSON.stringify(protocol.learning) !== JSON.stringify(REFINE_METRIC_CONFIG)) throw new Error('Candidate settings diverged from frozen protocol');
const fingerprint = paths => hash(Buffer.concat(paths.sort().flatMap(path=>[Buffer.from(path+'\n'),readFileSync(path)])));
const modelPaths = readdirSync('packages/domain/dist',{recursive:true}).filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')).map(p=>'packages/domain/dist/'+p);
const lockedModel = fingerprint([...modelPaths,'apps/dossier-cli/dist/actions.js']);
const evaluatorPaths = ['refine-run.mjs','refine-report.mjs','hard-metrics.mjs','real-metrics.mjs'].map(p=>'apps/dossier-cli/scripts/'+p);
const lockedEvaluator=fingerprint(evaluatorPaths);
const fixtures = {};
for (const [name,entry] of Object.entries(protocol.fixtures)) {
  const bytes = readFileSync(entry.path);
  if (hash(bytes)!==entry.sha256) throw new Error(`Frozen fixture changed: ${name}`);
  fixtures[name] = JSON.parse(bytes);
}
if(hash(readFileSync('apps/dossier-cli/scripts/prepare-refine.mjs')) !== protocol.generatorHash) throw new Error('Fixture generator changed');

// Only descriptive catalogue fields cross the CLI boundary.
function catalogueItem(raw) {
  const item = {id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,genreIds:raw.genreIds,
    keywords:raw.keywords,overview:raw.overview,runtime:raw.runtime,collection:raw.collection??null,
    directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],posterPath:null,voteAverage:null,voteCount:0,popularity:null};
  return {...item,features:featureVector(item)};
}
function makeViewer(cohort,fixture,person) {
  const items = fixture.items.map(catalogueItem), byKey = new Map(items.map(i=>[key(i),i]));
  if (person.trainingRatings) {
    return {id:person.id,cohort,seedKey:person.sourceUserId,byKey,
      training:person.trainingRatings.map(r=>({id:r.filmKey,rating:r.rating,utility:r.stars})),
      heldout:person.heldOutRatings.map(r=>({id:r.filmKey,rating:r.rating,utility:r.stars}))};
  }
  const rows = ids=>ids.map(id=>({id,rating:person.ratings[id],utility:person.utilities?.[id]??person.ratings[id]}));
  return {id:person.id,cohort,seedKey:Number(person.id.replace(/\D/g,''))||person.id.length,byKey,
    training:rows(fixture.trainingKeys),heldout:rows(fixture.holdoutKeys),noiseModulo:person.noiseModulo};
}
const viewers = Object.entries(fixtures).flatMap(([cohort,fixture]) => (fixture.viewers??fixture.personas).map(person=>
  makeViewer(cohort==='synthetic'?`synthetic_${person.partition}`:cohort,fixture,person)));
const selected = maxViewers ? viewers.slice(0,maxViewers) : viewers;
function client(viewer,candidateKeys) {
  let vault = {activeId:null,profiles:[]};
  const storage = {root:'/refine-experiment',load:()=>vault,save:next=>{vault=next;},audit:()=>{}};
  let pool = candidateKeys;
  const catalogue = {detail:async(medium,id)=>viewer.byKey.get(`${medium}:${id}`),
    candidates:async()=>pool.map(id=>viewer.byKey.get(id))};
  return {call:(action,args={})=>execute(storage,action,args,catalogue),state:()=>vault.profiles[0].state,
    setPool:keys=>{pool=keys;}};
}
const modes = protocol.arms.filter(a=>a.endsWith('metric'));
async function rank(cli,mode) {
  const rows = [], seen = new Set(); let cursor;
  do {
    const page = await cli.call('suggest.list',{limit:20,dials:{qualityWeight:0,popularityBias:0},
      ...(mode?{refineMetric:mode}:{}),...(cursor?{cursor}: {})});
    for (const row of page.items) {
      if(seen.has(row.id))throw new Error('Duplicate ranked item');
      seen.add(row.id); rows.push(row);
    }
    cursor=page.next;
  } while(cursor);
  return rows;
}
const scores = rows=>Object.fromEntries(rows.map(r=>[r.id,r.score]));
function allPairs(revealed,byKey) {
  const pairs=[];
  for(let i=0;i<revealed.length;i++)for(let j=i+1;j<revealed.length;j++) {
    const a=revealed[i], b=revealed[j];
    if (!a.rating || a.rating!==b.rating) continue;
    const ids=[a.id,b.id].sort();
    pairs.push({ids,similarity:cosineSimilarity(byKey.get(a.id).features,byKey.get(b.id).features)});
  }
  return pairs.sort((a,b)=>a.similarity-b.similarity || a.ids.join('|').localeCompare(b.ids.join('|')));
}
function pairAccuracy(scoreMap,hidden,excluded=new Set()) {
  const results=[];
  for(let i=0;i<hidden.length;i++)for(let j=i+1;j<hidden.length;j++) {
    const a=hidden[i],b=hidden[j];
    if(!a.rating || a.rating!==b.rating || a.utility===b.utility || excluded.has([a.id,b.id].sort().join('|')))continue;
    const difference=(scoreMap[a.id]??0)-(scoreMap[b.id]??0);
    results.push(difference===0?.5:Math.sign(difference)===Math.sign(a.utility-b.utility)?1:0);
  }
  return {accuracy:results.length?round(average(results)):null,pairs:results.length};
}
function metric(rows,viewer) {
  const candidates=viewer.heldout.map(r=>viewer.byKey.get(r.id));
  const truth=Object.fromEntries(viewer.heldout.map(r=>[r.id,r.rating]));
  return {...assess(scores(rows),candidates,truth,rows.length>0),unseenPairwise:pairAccuracy(scores(rows),viewer.heldout)};
}
function modelSnapshot(cli,mode) {
  const state=cli.state(), entries=Object.values(state.ratings), clusters=buildTasteSpace(entries).clusters;
  return learnRefineMetric(entries,state.pairwise,clusters,mode);
}
async function correction(cli,viewer,choices,mode,baselineRows) {
  if(choices.length<10) return null;
  const target=choices[9], revision=(await cli.call('profile.show')).revision;
  const beforeModel=modelSnapshot(cli,mode);
  await cli.call('refine.correct',{winner:target.loserKey,loser:target.winnerKey,expectedRevision:revision});
  const pool=[target.winnerKey,target.loserKey];
  const correctedModel=modelSnapshot(cli,mode);
  const fullAfter=await rank(cli,mode);
  // Fit on all ratings, but allow explicit replay of rated items through suggest.list.
  // Use a separate catalogue with aliases sharing features, outside the rated-key namespace.
  const aliasViewer={...viewer,byKey:new Map(viewer.byKey)};
  pool.forEach((id,index)=>aliasViewer.byKey.set(`movie:${9900000+index}`,{...viewer.byKey.get(id),id:9900000+index}));
  const test=client(aliasViewer,['movie:9900000','movie:9900001']);
  await test.call('profile.create',{name:'Correction pair'});
  Object.assign(test.state(),structuredClone(cli.state()));
  const after=await rank(test,mode);
  await test.call('refine.correct',{winner:target.winnerKey,loser:target.loserKey,expectedRevision:(await test.call('profile.show')).revision});
  const before=await rank(test,mode);
  const margin=rows=>scores(rows)['movie:9900001']-scores(rows)['movie:9900000'];
  const beforeMargin=margin(before),afterMargin=margin(after);
  const oldOrder=baselineRows.map(r=>r.id),newOrder=fullAfter.map(r=>r.id);
  const movement=oldOrder.map((id,i)=>Math.abs(i-newOrder.indexOf(id)));
  // Restore the original constraint for later comparison budgets.
  await cli.call('refine.correct',{winner:target.winnerKey,loser:target.loserKey,expectedRevision:(await cli.call('profile.show')).revision});
  return {beforeMargin,afterMargin,directionImproved:afterMargin>beforeMargin,strictReversal:beforeMargin<0&&afterMargin>0,
    replacementCount:cli.state().pairwise.filter(p=>[p.winnerKey,p.loserKey].sort().join('|')===pool.slice().sort().join('|')).length,
    meanCollateralRankMovement:round(average(movement)),maxCollateralRankMovement:Math.max(0,...movement),
    axisWeightChange:round(average(Object.keys(beforeModel.axisWeights).map(axis=>Math.abs(beforeModel.axisWeights[axis]-correctedModel.axisWeights[axis]))))};
}
async function session(viewer,seed) {
  const order=shuffled(viewer.training,seed+viewer.seedKey*1009);
  if(order.length<30 || viewer.training.some(r=>viewer.heldout.some(h=>h.id===r.id)))throw new Error('Training split invalid');
  const cli=client(viewer,viewer.heldout.map(r=>r.id));
  let revision=(await cli.call('profile.create',{name:'Refine viewer'})).revision;
  const revealed=[];
  for(const row of order.slice(0,20)) {
    const supplied=viewer.noiseModulo && Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating;
    revision=(await cli.call('rate.set',{key:row.id,value:supplied,expectedRevision:revision})).revision;
    revealed.push({id:row.id,rating:supplied});
  }
  const baselineRows=await rank(cli), baseline=metric(baselineRows,viewer);
  const pairs=allPairs(revealed,viewer.byKey), truth=new Map(order.slice(0,20).map(r=>[r.id,r]));
  const choices=[], checkpoints={},traces=Object.fromEntries(modes.map(mode=>[mode,[]])); let prompts=0,ties=0,pairIndex=0,promptBudget=null;
  const capturePromptBudget=async()=>{promptBudget=Object.fromEntries(await Promise.all(protocol.arms.map(async arm=>[arm,metric(await rank(cli,modes.includes(arm)?arm:undefined),viewer)])));};
  for(const budget of protocol.comparisons) {
    while(choices.length<budget && pairIndex<pairs.length) {
      const {ids}=pairs[pairIndex++]; prompts++;
      const a=truth.get(ids[0]),b=truth.get(ids[1]);
      if(a.utility===b.utility){ties++;if(prompts===10)await capturePromptBudget();continue;}
      const winner=a.utility>b.utility?a.id:b.id,loser=a.utility>b.utility?b.id:a.id;
      revision=(await cli.call('refine.choose',{winner,loser,expectedRevision:revision})).revision;
      choices.push({winnerKey:winner,loserKey:loser});
      if(prompts===10)await capturePromptBudget();
      for(const mode of modes) {
        const auc=metric(await rank(cli,mode),viewer).auc;
        const previous=traces[mode].at(-1)?.auc??baseline.auc;
        traces[mode].push({answered:choices.length,auc,delta:round(auc-previous)});
      }
    }
    const noopRows=await rank(cli);
    if(JSON.stringify(noopRows)!==JSON.stringify(baselineRows))throw new Error('Stored comparisons changed default scoring');
    const arms={ratings_only:baseline,stored_noop:metric(noopRows,viewer)};
    const models={},corrections={},noise={};
    for(const mode of modes) {
      const rows=await rank(cli,mode); arms[mode]=metric(rows,viewer); models[mode]=modelSnapshot(cli,mode);
      if(budget===10) {
        corrections[mode]=await correction(cli,viewer,choices,mode,rows);
        revision=(await cli.call('profile.show')).revision;
        const corrupted=client(viewer,viewer.heldout.map(r=>r.id));
        await corrupted.call('profile.create',{name:'Comparison noise'});
        Object.assign(corrupted.state(),structuredClone(cli.state()));
        const flips=shuffled(choices,seed+2017).slice(0,Math.floor(choices.length*.1));
        for(const flip of flips) await corrupted.call('refine.correct',{winner:flip.loserKey,loser:flip.winnerKey,expectedRevision:(await corrupted.call('profile.show')).revision});
        noise[mode]={flipped:flips.length,...metric(await rank(corrupted,mode),viewer)};
      }
    }
    checkpoints[budget]={requested:budget,answered:choices.length,prompts,ties,exhausted:choices.length<budget,arms,models,corrections,noise};
  }
  if(!promptBudget)await capturePromptBudget();
  const control=client(viewer,viewer.heldout.map(r=>r.id));
  let rev=(await control.call('profile.create',{name:'Thirty-rating control'})).revision;
  for(const row of order.slice(0,30))rev=(await control.call('rate.set',{key:row.id,value:viewer.noiseModulo&&Number(row.id.split(':')[1])%viewer.noiseModulo===0?-row.rating:row.rating,expectedRevision:rev})).revision;
  return {seed,checkpoints,ratingControl:metric(await rank(control),viewer),eligiblePairs:pairs.length,traces,promptBudget};
}
const started=performance.now(),viewerResults=[];
for(const [index,viewer] of selected.entries()) {
  if(viewer.cohort==='synthetic_sealed' && (fingerprint([...modelPaths,'apps/dossier-cli/dist/actions.js'])!==lockedModel || fingerprint(evaluatorPaths)!==lockedEvaluator))throw new Error('Model changed before sealed confirmation');
  const sessions=[];
  for(const seed of protocol.seeds)sessions.push(await session(viewer,seed));
  viewerResults.push({viewer:viewer.id,cohort:viewer.cohort,sessions});
  if(index%5===0 || index+1===selected.length)process.stderr.write(`Refine viewers ${index+1}/${selected.length} (${viewer.cohort})\n`);
}
function viewerMean(viewer,budget,arm,field='auc') {return average(viewer.sessions.map(s=>s.checkpoints[budget].arms[arm][field]));}
function aggregate(rows) {
  const learning={};
  for(const budget of protocol.comparisons) {
    learning[budget]={};
    for(const arm of protocol.arms) {
      const aucs=rows.map(v=>viewerMean(v,budget,arm));
      const gains=rows.map(v=>viewerMean(v,budget,arm)-viewerMean(v,budget,'ratings_only'));
      const eligible=budget===10?rows.filter(v=>v.sessions.every(s=>s.checkpoints[budget].answered===budget)):[];
      const corrections=rows.flatMap(v=>v.sessions.map(s=>s.checkpoints[budget].corrections[arm]).filter(Boolean));
      const unseen=rows.map(v=>{const s=v.sessions.map(s=>s.checkpoints[budget].arms[arm].unseenPairwise).filter(p=>p.pairs);return s.length?average(s.map(p=>p.accuracy)):null;}).filter(v=>v!==null);
      learning[budget][arm]={auc:distribution(aucs),ndcg10:distribution(rows.map(v=>viewerMean(v,budget,arm,'ndcg10'))),gain:meanInterval(gains),
        losses:gains.filter(g=>g<0).length,largeLosses:gains.filter(g=>g<=-.05).length,worstViewerDelta:round(Math.min(0,...gains)),
        unseenPairwise:unseen.length?distribution(unseen):null,unseenPairwiseViewers:unseen.length,
        equalBudgetGain:meanInterval(eligible.map(v=>viewerMean(v,budget,arm)-average(v.sessions.map(s=>s.ratingControl.auc)))),
        equalBudgetNdcgGain:meanInterval(eligible.map(v=>viewerMean(v,budget,arm,'ndcg10')-average(v.sessions.map(s=>s.ratingControl.ndcg10)))),
        eligibleEqualBudgetViewers:eligible.length,
        tenPromptGain:budget===10?meanInterval(rows.map(v=>average(v.sessions.map(s=>s.promptBudget[arm].auc-s.ratingControl.auc)))):null,
        worstComparisonStep:modes.includes(arm)?Math.min(0,...rows.flatMap(v=>v.sessions.flatMap(s=>s.traces[arm].map(t=>t.delta)))):0,
        correction:{tested:corrections.length,directionImproved:corrections.filter(c=>c.directionImproved).length,strictReversal:corrections.filter(c=>c.strictReversal).length,
          meanCollateralRankMovement:round(average(corrections.map(c=>c.meanCollateralRankMovement))),maxCollateralRankMovement:Math.max(0,...corrections.map(c=>c.maxCollateralRankMovement))},
        noise:budget===10&&modes.includes(arm)?{auc:distribution(rows.map(v=>average(v.sessions.map(s=>s.checkpoints[10].noise[arm].auc)))),gain:meanInterval(rows.map(v=>average(v.sessions.map(s=>s.checkpoints[10].noise[arm].auc))-viewerMean(v,10,'ratings_only')))}:null};
    }
    learning[budget].interactions={answered:distribution(rows.map(v=>average(v.sessions.map(s=>s.checkpoints[budget].answered)))),prompts:distribution(rows.map(v=>average(v.sessions.map(s=>s.checkpoints[budget].prompts)))),
      exhaustedSessions:rows.flatMap(v=>v.sessions).filter(s=>s.checkpoints[budget].exhausted).length,sessions:rows.length*protocol.seeds.length};
  }
  return {viewers:rows.length,learning};
}
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,aggregate(viewerResults.filter(v=>v.cohort===c))]));
const recorded=aggregate(viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort)));
function gates(group,mode) {
  const row=group.learning[10][mode],base=group.learning[10].ratings_only;
  return {minimumGain:row.gain.mean>=protocol.gates.minimumGain,positiveLowerBound:row.gain.lower>0,
    worstDecile:row.auc.p10-base.auc.p10>=protocol.gates.worstDecileMinimumDelta,
    equalBudget:row.eligibleEqualBudgetViewers>0&&(row.equalBudgetGain.lower>0||row.equalBudgetNdcgGain.lower>0),
    correction:row.correction.tested>0&&row.correction.strictReversal/row.correction.tested>=protocol.gates.correctionReversalRate,
    noisyWorstDecile:row.noise.auc.p10-base.auc.p10>=protocol.gates.noiseWorstDecileMinimumDelta};
}
const candidates=modes.map(mode=>({mode,recorded:gates(recorded,mode),sealed:cohorts.synthetic_sealed?gates(cohorts.synthetic_sealed,mode):null}));
for(const c of candidates)c.passed=c.sealed!==null&&Object.values(c.recorded).every(Boolean)&&Object.values(c.sealed).every(Boolean);
const passed=candidates.filter(c=>c.passed).sort((a,b)=>recorded.learning[10][b.mode].gain.mean-recorded.learning[10][a.mode].gain.mean);
const decision={status:maxViewers?'smoke_only':passed.length?'promote_for_confirmation':'do_not_promote',selected:maxViewers?null:passed[0]?.mode??null,
 reason:maxViewers?'Limited runs cannot select a model.':passed.length?'The candidate passed every frozen gate; seek independent human confirmation.':'Neither metric passed every frozen gain, control, efficiency, and safety gate.'};
const report={version:protocol.version,protocol,protocolHash:hash(protocolBytes),modelFingerprint:lockedModel,evaluatorFingerprint:lockedEvaluator,
 durationSeconds:round((performance.now()-started)/1000,2),viewers:viewerResults.length,sessions:viewerResults.length*protocol.seeds.length,cohorts,recorded,candidates,decision,viewerResults};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,viewers:report.viewers,decision,candidates,durationSeconds:report.durationSeconds}));
