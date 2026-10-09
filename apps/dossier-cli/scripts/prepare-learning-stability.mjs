import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { featureVector, LOCAL_EVIDENCE_CONFIG } from '@dossier/domain';
import { random, shuffled, key } from './hard-metrics.mjs';
const fixturePath='apps/dossier-cli/src/lab/learning-stability-v1.json';
const protocolPath='apps/dossier-cli/benchmarks/learning-stability-v1-protocol.json';
assert(!existsSync(fixturePath)&&!existsSync(protocolPath),'Create a new version instead of replacing frozen inputs');
const next=random(971031),genres=['Drama','Comedy','Action','Science Fiction','Thriller'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief','survival','satire'];
const items=Array.from({length:180},(_,i)=>{
 const raw={id:9100000+i,medium:'movie',title:`Stability catalogue ${i+1}`,year:1970+Math.floor(next()*55),posterPath:null,
  genres:shuffled(genres,Math.floor(next()*1e8)).slice(0,1+(i%3===0?1:0)),genreIds:[],
  keywords:shuffled(tags,Math.floor(next()*1e8)).slice(0,2+(i%4===0?1:0)),overview:'',runtime:80+Math.floor(next()*80),
  collection:null,directorIds:[],creatorIds:[],voteAverage:null,voteCount:0,popularity:null};
 return {...raw,features:featureVector(raw)};
});
const keys=items.map(key),training=keys.slice(0,100),holdout=keys.slice(100);
const viewers=[],types=['stable_axes','interactions','missing_factor','noisy_ratings','changing_taste','weak_ratings'];
for(const partition of ['development','sealed'])for(const type of types)for(let n=0;n<10;n++){
 const seed=Math.floor(next()*1e8),rng=random(seed),axes=shuffled(['tone','pacing','complexity','character_focus','thematic_weight'],seed);
 const signs=[rng()<.5?-1:1,rng()<.5?-1:1,rng()<.5?-1:1];
 const selectedTag=tags[Math.floor(rng()*tags.length)],selectedGenre=genres[Math.floor(rng()*genres.length)];
 const craft=Object.fromEntries(keys.map(k=>[k,rng()*2-1]));
 const utility=(item,old=false)=>{
  const k=key(item);let u=craft[k]*(type==='missing_factor'?4:.7);
  if(type==='missing_factor')return u;
  u+=2*signs[0]*(old?-1:1)*item.features[axes[0]]+1.2*signs[1]*item.features[axes[1]];
  if(partition==='sealed')u+=.8*signs[2]*item.features[axes[2]];
  if(type==='interactions'&&item.keywords.includes(selectedTag)&&item.genres.includes(selectedGenre))u+=3*signs[2];
  return u;
 };
 const center=old=>items.map(item=>utility(item,old)).sort((a,b)=>a-b)[Math.floor(items.length/2)];
 const currentCenter=center(false),oldCenter=center(true);
 const rating=u=>Math.abs(u)<.15?0:(u>0?1:-1)*(type==='weak_ratings'?1:Math.abs(u)>2?3:2);
 const ratings=Object.fromEntries(items.map(item=>[key(item),rating(utility(item)-currentCenter)]));
 const oldRatings=Object.fromEntries(items.map(item=>[key(item),rating(utility(item,true)-oldCenter)]));
 assert(holdout.some(k=>ratings[k]>0)&&holdout.some(k=>ratings[k]<0));
 viewers.push({id:`stability-${partition}-${type}-${n}`,partition,type,seed,trainingKeys:training,
  holdoutKeys:holdout,ratings,oldRatings,noise:type==='noisy_ratings'?.15:0});
}
const hash=b=>createHash('sha256').update(b).digest('hex');
writeFileSync(fixturePath,JSON.stringify({version:'learning-stability-v1',items,viewers},null,2)+'\n');
const protocol={version:'learning-stability-v1',experiment:9,previousCommit:'09b3e82',
 fixture:{path:fixturePath,sha256:hash(readFileSync(fixturePath))},generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-learning-stability.mjs')),
 arms:['current','canonical_greedy','canonical_complete_link','local','local_recent'],candidate:LOCAL_EVIDENCE_CONFIG,
 seeds:[31,73],ratings:60,checkpoints:[10,20,40,60],permutations:8,totalViewers:120,confirmationViewers:60,
 clock:{start:1700000000000,stepDays:2},
 hypothesis:'Direct local evidence removes centroid movement and top-K dilution. Recency can preserve adaptation when older preferences change.',
 model:'Local candidates sum signed cosine-to-the-fourth evidence, weighted by rating strength, over a prior plus total local weight. Recent uses a fixed 30-day half-life. Both retain current inferred claim contributions. No candidate strength tuning.',
 boundary:'Only public metadata and revealed ratings enter the CLI. Hidden ratings, viewer types, private utility, and future ratings stay in the evaluator. Synthetic public quality is absent. Historical checks retain default public quality. No calibration selection or explicit correction policy changes.',
 actors:'Six types with ten people per partition. Reserved people add a third axis preference. Noisy ratings flip 15 percent of revealed values. Changing people reveal opposite first-axis preferences for the first 30 ratings, then current taste. Missing factors stay outside metadata.',
 updates:'Sixty chronological ratings, plus one rerating, clearing, and restoration through the app transition. Deterministic observation timestamps replace the wall clock in the lab immediately after the action. Held-out target taste remains fixed throughout each learning curve.',
 order:'Eight permutations of the identical final library retain timestamps and stored claims. This isolates scorer order sensitivity, rather than treating chronological evidence as interchangeable. Actual learning sessions retain ordinary claim reconciliation.',
 gates:{minimumMeanGain:.02,worstDecileDelta:-.01,subgroupLowerDelta:-.01,maxSingleRatingLoss:.05,largeLossRateRatio:.5,historicalFinalGain:.03,historicalTotalDecline:-.03},
 selection:'Reserved people only; positive gain lower bound, two-point mean gain, worst-tenth protection, stable and changing-taste lower bounds above minus one point, zero order spread, at least halved large-loss frequency, and at most five-point loss after ten ratings. Every historical severe failure must improve final accuracy three points, limit total decline to three points, and avoid five-point step losses. Restoration, overwrite, CLI parity, archive integrity, and unchanged default comparisons must pass. Passing earns adoption review, not an automatic default change.',
 limitations:['Synthetic ranking on known film candidates, not retrieval or television.','Noisy ratings differ from noisy explanations; previous correction experiments cover explanation errors.','Recency uses simulated two-day intervals; no optimal half-life claim.','Order tests hold claims and timestamps fixed and do not claim inference history independence.','Local similarity cannot recover factors absent from metadata.','Jamie remains the only real product user.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({fixturePath,protocolPath,viewers:viewers.length}));
