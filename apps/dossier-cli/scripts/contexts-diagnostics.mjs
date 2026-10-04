import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { scoreCandidates, DEFAULT_SCORING_PARAMS } from '@dossier/domain';
import { key, assess, average, distribution } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';
import { replayLibrary } from './library-replay.mjs';
const source='reports/contextual-taste-v1.json';
const bytes=existsSync(source)?readFileSync(source):gunzipSync(readFileSync(source+'.gz')),report=JSON.parse(bytes);
const fixture=JSON.parse(readFileSync(report.protocol.fixtures.synthetic.path));
const byKey=new Map(fixture.items.map(raw=>[key(raw),{id:raw.id,medium:raw.medium,title:raw.title,year:raw.year,genres:raw.genres,
 genreIds:raw.genreIds??[],keywords:raw.keywords??[],overview:raw.overview??'',runtime:raw.runtime??null,collection:raw.collection??null,
 directorIds:raw.directorIds??[],creatorIds:raw.creatorIds??[],features:raw.features,posterPath:null,voteAverage:null,voteCount:0,popularity:null}]));
const viewerResults=[];
for(const v of report.viewerResults.filter(v=>v.fresh)){
 const person=fixture.viewers.find(p=>p.id===v.viewer),sessions=[];
 for(const s of v.sessions){
  const all=[...s.globalEvents,...s.events];
  const state=replayLibrary(all,byKey);
  const candidates=person.holdoutKeys.map(k=>byKey.get(k)),referenceTime=Math.max(...all.map(e=>e.ts));
  const metrics={};
  for(const arm of ['global','recency']){
   const rows=scoreCandidates(candidates,Object.values(state.ratings),{...DEFAULT_SCORING_PARAMS,qualityWeight:0,
    ratingRecencyStrength:arm==='recency'?1:0},state.tasteClaims,{referenceTime});
   const scores=Object.fromEntries(rows.map(r=>[key(r.item),r.score]));
   metrics[arm]=average(report.protocol.contexts.map(c=>assess(scores,candidates,person.ratings[c],rows.length>0).auc));
  }
  sessions.push({seed:s.seed,observations:all.length,uniqueItems:Object.keys(state.ratings).length,overwriteGlobal:metrics.global,
   overwriteRecency:metrics.recency,shared:average(report.protocol.contexts.map(c=>s.checkpoints[20].shared[c].auc)),
   pooledGlobal:average(report.protocol.contexts.map(c=>s.checkpoints[20].global[c].auc))});
 }
 viewerResults.push({viewer:v.viewer,cohort:v.cohort,type:v.type,sessions});
}
const summarize=rows=>({viewers:rows.length,
 overwriteGlobal:distribution(rows.map(v=>average(v.sessions.map(s=>s.overwriteGlobal)))),
 overwriteRecency:distribution(rows.map(v=>average(v.sessions.map(s=>s.overwriteRecency)))),
 sharedGainOverOverwrite:meanInterval(rows.map(v=>average(v.sessions.map(s=>s.shared-s.overwriteGlobal)))),
 sharedGainOverOverwriteRecency:meanInterval(rows.map(v=>average(v.sessions.map(s=>s.shared-s.overwriteRecency)))),
 pooledMinusOverwrite:meanInterval(rows.map(v=>average(v.sessions.map(s=>s.pooledGlobal-s.overwriteGlobal)))),
 duplicateObservations:average(rows.flatMap(v=>v.sessions.map(s=>s.observations-s.uniqueItems)))});
const cohorts=Object.fromEntries([...new Set(viewerResults.map(v=>v.cohort))].map(c=>[c,summarize(viewerResults.filter(v=>v.cohort===c))]));
const types=Object.fromEntries([...new Set(viewerResults.map(v=>v.type))].map(t=>[t,summarize(viewerResults.filter(v=>v.type===t))]));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output='reports/contextual-taste-diagnostics-v1.json';
writeFileSync(output,JSON.stringify({version:'contextual-taste-diagnostics-v1',sourceHash:hash(bytes),scriptHash:hash(readFileSync('apps/dossier-cli/scripts/contexts-diagnostics.mjs')),
 limitation:'Exploratory overwrite-baseline audit. Frozen global and recency arms retain repeated observations; the current library overwrites the same item. This audit does not change candidates, gates, or decisions.',
 cohorts,types,viewerResults},null,2)+'\n');
console.log(JSON.stringify({output,cohorts}));
