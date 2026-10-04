import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { average, distribution } from './hard-metrics.mjs';
const reportPath='reports/question-policy-v1.json';
const reportBytes=existsSync(reportPath)?readFileSync(reportPath):gunzipSync(readFileSync(reportPath+'.gz')),r=JSON.parse(reportBytes);
const fixtures=Object.fromEntries(Object.entries(r.protocol.fixtures).map(([k,f])=>[k,JSON.parse(readFileSync(f.path))]));
const groups={recorded:r.viewerResults.filter(v=>['original','confirmation','override'].includes(v.cohort)),synthetic_sealed:r.viewerResults.filter(v=>v.cohort==='synthetic_sealed')};
function entropy(items){
 const counts=new Map();for(const item of items)for(const genre of item.genres)counts.set(genre,(counts.get(genre)??0)+1/item.genres.length);
 const total=[...counts.values()].reduce((a,b)=>a+b,0);
 return -[...counts.values()].reduce((sum,c)=>sum+(c/total)*Math.log2(c/total),0);
}
const diagnostics=Object.fromEntries(Object.entries(groups).map(([name,viewers])=>[name,Object.fromEntries(r.protocol.arms.map(arm=>{
 const rows=viewers.map(v=>{
  const fixture=fixtures[v.cohort==='synthetic_sealed'?'synthetic':v.cohort],byKey=new Map(fixture.items.map(i=>[`${i.medium}:${i.id}`,i]));
  const sessions=v.sessions.filter(s=>s.arm===arm);
  const claimRates=sessions.map(s=>{const m=s.byPrompt[40].metric;return m.highConfidenceClaimTests?m.highConfidenceClaimErrors/m.highConfidenceClaimTests:null;}).filter(rate=>rate!==null);
  return {post10Loss:Math.min(0,...sessions.flatMap(s=>s.traces.filter(t=>t.recognized&&t.answers>10).map(t=>t.aucDelta))),
   genreEntropy:average(sessions.map(s=>entropy(s.traces.filter(t=>t.recognized&&t.prompts<=40).map(t=>byKey.get(t.id))))),
   claimErrorRate:claimRates.length?average(claimRates):null,
   activeClaims:average(sessions.map(s=>s.byPrompt[40].metric.activeClaims))};
 });
 return [arm,{post10WorstAnswerLoss:Math.min(0,...rows.map(v=>v.post10Loss)),observedGenreEntropy:distribution(rows.map(v=>v.genreEntropy)),
  highConfidenceClaimErrorRate:distribution(rows.map(v=>v.claimErrorRate).filter(rate=>rate!==null)),claimEvaluatedViewers:rows.filter(v=>v.claimErrorRate!==null).length,activeClaims:distribution(rows.map(v=>v.activeClaims))}];
}))]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
writeFileSync('reports/question-policy-diagnostics-v1.json',JSON.stringify({version:'question-policy-diagnostics-v1',postHoc:true,
 purpose:'Describe evidence coverage, claim errors, and post-cold-start losses. These diagnostics cannot change frozen gates or establish causation.',
 sourceReportHash:sha(reportBytes),diagnosticHash:sha(readFileSync('apps/dossier-cli/scripts/question-policy-diagnostics.mjs')),diagnostics},null,2)+'\n');
console.log(JSON.stringify(diagnostics));
