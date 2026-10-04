import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AXIS_KEYS, featureVector } from '@dossier/domain';
import { random, key, shuffled } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/hard-v5-contexts.json';
const protocolPath='apps/dossier-cli/benchmarks/contextual-taste-v1-protocol.json';
if(existsSync(fixturePath)||existsSync(protocolPath))throw new Error('Frozen context protocol exists; create another version.');
const next=random(202610035),source=JSON.parse(readFileSync('apps/dossier-cli/src/lab/hard-v1.json'));
const contexts=['solo','family','comfort','challenging'],items=[],viewers=[];
const quantize=u=>u>=1.1?3:u>=.55?2:u>=.12?1:u<=-1.1?-3:u<=-.55?-2:u<=-.12?-1:0;
for(const domain of ['movies','books']) {
 for(let i=0;i<240;i++) {
  const base=source.items[Math.floor(next()*source.items.length)];
  items.push({...base,id:(domain==='movies'?510000:520000)+i,medium:'movie',domain,title:`${domain} context specimen ${i+1}`,
   genres:domain==='books'?[['Literary','Mystery','Speculative','Adventure'][i%4]]:base.genres,
   keywords:[...(base.keywords??[]),...(i%2?['ensemble-form']:[])],
   features:domain==='movies'?featureVector(base):Object.fromEntries(AXIS_KEYS.map(a=>[a,(next()-.5)*1.8])),
   voteAverage:null,popularity:null,voteCount:0});
 }
 const pool=items.filter(i=>i.domain===domain),training=pool.slice(0,160),heldout=pool.slice(160);
 const means=Object.fromEntries(AXIS_KEYS.map(a=>[a,pool.reduce((n,i)=>n+i.features[a],0)/pool.length]));
 const variableAxes=AXIS_KEYS.filter(a=>pool.reduce((n,i)=>n+(i.features[a]-means[a])**2,0)/pool.length>.025);
 const axisValue=(item,a)=>item.features[a]-means[a];
 for(let index=0;index<48;index++) {
  const type=['axis_switch','interaction_switch','stable','drift','sparse','hidden_switch'][index%6];
  const axis=variableAxes[(index*3+1)%variableAxes.length],other=variableAxes[(index*3+2)%variableAxes.length],sign=Math.floor(index/6)%2?1:-1;
  const utilities={},ratings={},hidden=Object.fromEntries(pool.map(i=>[key(i),(next()-.5)*2]));
  const utility=(item,context,latest)=>{
   const common=.8*axisValue(item,other)+.35*axisValue(item,variableAxes[(index*3+3)%variableAxes.length]);
   const direction=context==='global'?0:contexts.indexOf(context)%2?1:-1;
   let delta=0;
   if(type==='axis_switch'||type==='sparse')delta=context==='global'?0:direction*1.45*axisValue(item,axis);
   if(type==='interaction_switch')delta=context==='global'?0:direction*1.6*(item.keywords.includes('ensemble-form')&&item.features[axis]>0?1:-.5);
   if(type==='hidden_switch')delta=context==='global'?0:direction*1.4*hidden[key(item)];
   if(type==='drift')delta=(latest?1:-1)*1.45*axisValue(item,axis);
   return sign*(common+delta)+(next()-.5)*.08;
  };
  for(const context of ['global',...contexts]) {
   utilities[context]={};ratings[context]={};
   for(const item of pool){const u=utility(item,context,true);utilities[context][key(item)]=u;ratings[context][key(item)]=quantize(u);}
  }
  const order=shuffled(training,202610035+index*79+(domain==='books'?991:0)),globalKeys=order.slice(0,20).map(key);
  const globalEvents=globalKeys.map((id,i)=>({key:id,rating:type==='drift'?quantize(utility(pool.find(j=>key(j)===id),'global',false)):ratings.global[id],ts:1700000000000+i*86400000}));
  const scoped=contexts.map((context,c)=>{
   const max=type==='sparse'?[20,10,3,0][c]:20;
   return shuffled(order.slice(20),index*431+c*113+19).slice(0,max).map((item,i)=>({context,key:key(item),rating:ratings[context][key(item)],ts:1700000000000+(180+i*4+c)*86400000}));
  });
  const events=[];
  for(let i=0;i<20;i++)for(let c=0;c<4;c++)if(scoped[c][i])events.push(scoped[c][i]);
  const holdoutKeys=heldout.map(key);
  if(['global',...contexts].some(c=>!holdoutKeys.some(k=>ratings[c][k]>0)||!holdoutKeys.some(k=>ratings[c][k]<0)))throw new Error('Missing holdout polarity');
  viewers.push({id:`contexts-${domain}-${index+1}`,domain,type,partition:index<24?'development':'sealed',globalEvents,events,holdoutKeys,ratings,utilities});
 }
}
writeFileSync(fixturePath,JSON.stringify({version:'hard-v5-contexts',seed:202610035,contexts,items,viewers})+'\n');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const previous=JSON.parse(readFileSync('apps/dossier-cli/benchmarks/personal-lens-45-v1-protocol.json'));
const fixtures={...previous.fixtures,lens45_regression:previous.fixtures.synthetic};
fixtures.synthetic={path:fixturePath,sha256:sha(fixturePath)};
const protocol={version:'contextual-taste-v1',experiment:'5',generatorHash:sha('apps/dossier-cli/scripts/prepare-contexts.mjs'),fixtures,
 arms:['global','recency','separate','shared'],seeds:[11,29],contexts,budgets:[0,1,3,5,10,20],globalRatings:20,
 candidate:{ridge:6,prior:8,minRatings:3,maxResidual:.8,recencyStrength:1},
 gates:{minimumContextGain:.02,worstDecileMinimumDelta:-.01,stableNoninferiority:-.01,maxSingleRatingLoss:.05,minimumCorrectionDirection:.9,minimumClaimPrecision:.6},
 privacy:'Catalogue allowlist includes descriptive metadata only. Scorers never receive utilities, hidden factors, held-out labels, public scores, other-person data, or synthetic type.',
 bootstrap:'Average sessions and contexts within each person; bootstrap people 5000 times. Sealed domains pass separately.',
 hypothesis:'Explicit context can explain situated contradictions while preserving global taste, sparse-context fallback, scoped control, and portability.',
 design:'Twenty explicitly global ratings plus up to twenty ratings per context. Shared anchors on global evidence and fits ridge residuals in existing axes. Global and recency pool all events. Separate uses scoped evidence only. No cross-context residual pooling.',
 selection:'Require contextual gains over global and recency, sparse-context gains over separate, stable-taste noninferiority, p10 protection, update safety, directional corrections, scope isolation, claim precision, deterministic replay, and encrypted roundtrip. Passing supports human confirmation only.',
 limits:['Fresh cohorts provide synthetic confirmation only.','Synthetic movies reuse the existing descriptive lens; books use invented vectors.','Residuals cannot learn metadata interactions or absent factors.','Contexts are supplied correctly; context discovery and prompt cost are not tested.','Global anchoring deliberately trades pooled learning for scope stability.','Recorded people have no context labels; they support no-context regressions only.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({version:protocol.version,viewers:viewers.length,items:items.length}));
