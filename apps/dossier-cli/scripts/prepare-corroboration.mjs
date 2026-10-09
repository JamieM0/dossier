import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector } from '@dossier/domain';
import { random, shuffled, key } from './hard-metrics.mjs';
import { CORROBORATION_CONFIG, CORROBORATION_ARMS } from './corroboration-policy.mjs';
const fixturePath='apps/dossier-cli/src/lab/corroboration-v1.json',protocolPath='apps/dossier-cli/benchmarks/corroboration-v1-protocol.json';
assert(!existsSync(fixturePath)&&!existsSync(protocolPath),'Create a new version instead of replacing frozen inputs');
const next=random(261005731),genres=['Drama','Comedy','Action','Science Fiction','Thriller'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief','survival','satire'];
const items=Array.from({length:180},(_,i)=>{
  const raw={id:9200000+i,medium:'movie',title:`Corroboration catalogue ${i+1}`,year:1970+Math.floor(next()*55),posterPath:null,
    genres:shuffled(genres,Math.floor(next()*1e8)).slice(0,1+(i%3===0?1:0)),genreIds:[],keywords:shuffled(tags,Math.floor(next()*1e8)).slice(0,2+(i%4===0?1:0)),
    overview:'',runtime:80+Math.floor(next()*80),collection:null,directorIds:[],creatorIds:[],voteAverage:null,voteCount:0,popularity:null};
  return {...raw,features:featureVector(raw)};
});
// Include metadata duplicates so separate titles cannot automatically count as independent support.
for(let i=11;i<items.length;i+=12)items[i]={...structuredClone(items[i-1]),id:items[i].id,title:items[i].title};
const keys=items.map(key),training=keys.slice(0,100),holdout=keys.slice(100),viewers=[];
const types=['stable_axes','interactions','missing_factor','isolated_noise','repeated_noise','biased_noise','changing_taste','weak_ratings'];
for(const partition of ['development','sealed','confirmation'])for(const type of types)for(let n=0;n<(partition==='development'?4:8);n++){
  const seed=Math.floor(next()*1e8),rng=random(seed),axes=shuffled(['tone','pacing','complexity','character_focus','thematic_weight'],seed);
  const signs=[rng()<.5?-1:1,rng()<.5?-1:1,rng()<.5?-1:1],selectedTag=tags[Math.floor(rng()*tags.length)],selectedGenre=genres[Math.floor(rng()*genres.length)];
  const craft=Object.fromEntries(keys.map(k=>[k,rng()*2-1]));
  const utility=(item,old=false)=>{
    if(type==='missing_factor')return craft[key(item)]*4;
    let u=.7*craft[key(item)]+2*signs[0]*(old?-1:1)*item.features[axes[0]]+1.2*signs[1]*item.features[axes[1]];
    if(partition!=='development')u+=.8*signs[2]*item.features[axes[2]];
    if(type==='interactions'&&item.keywords.includes(selectedTag)&&item.genres.includes(selectedGenre))u+=3*signs[2];
    return u;
  };
  const center=old=>items.map(i=>utility(i,old)).sort((a,b)=>a-b)[90],currentCenter=center(false),oldCenter=center(true);
  const rating=u=>Math.abs(u)<.15?0:(u>0?1:-1)*(type==='weak_ratings'?1:Math.abs(u)>2?3:2);
  const ratings=Object.fromEntries(items.map(i=>[key(i),rating(utility(i)-currentCenter)]));
  const oldRatings=Object.fromEntries(items.map(i=>[key(i),rating(utility(i,true)-oldCenter)]));
  assert(holdout.some(k=>ratings[k]>0)&&holdout.some(k=>ratings[k]<0));
  viewers.push({id:`corroboration-${partition}-${type}-${n}`,partition,type,seed,trainingKeys:training,holdoutKeys:holdout,ratings,oldRatings,biasedGenre:selectedGenre});
}
const hash=b=>createHash('sha256').update(b).digest('hex');
writeFileSync(fixturePath,JSON.stringify({version:'corroboration-v1',items,viewers},null,2)+'\n');
const protocol={version:'corroboration-v1',experiment:10,fixture:{path:fixturePath,sha256:hash(readFileSync(fixturePath))},
  generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-corroboration.mjs')),arms:CORROBORATION_ARMS,candidate:CORROBORATION_CONFIG,
  seeds:[47,89],ratings:60,changeAt:30,checkpoints:[10,20,30,40,60],permutations:8,totalViewers:160,selectionViewers:64,confirmationViewers:64,
  clock:{start:1700000000000,stepDays:2},
  hypothesis:'Independent supporting ratings can reduce noisy generalization while retaining quality and adaptation. Claim guards isolate inference contributions from local matching.',
  model:'Use the existing power, prior, and recency. Divide near-duplicate same-polarity rating weight by its density at cosine 0.95, for both support and final kernel contributions. Each rating gets a leave-one-out gate support/(2+support+counter). Kernel candidates retain existing claims. Joint candidates also gate inferred claim confidence by support excluding its strongest independent contribution over 2+support+counter. User-confirmed claims and inactive tombstones retain their authority. No fitted settings.',
  boundary:'Only public metadata, supplied ratings, and stored claims enter scorers. Private utilities, error labels, cohort types, and future preferences stay in the evaluator. Policies are lab-only; no product source or scoring default changes.',
  actors:'Fresh catalogue and people. Three partitions: 32 development, 64 selection, and 64 independent confirmation. Accurate stable axes, interactions, missing factors, isolated noise at 14, repeated noise at 14 through 18, genre-biased noise at 11 through 30, changing taste, and weak ratings. Reserved people add a third axis preference. Metadata duplicates challenge apparent independence.',
  metrics:'Final ranking uses current taste. At every update, both old and new scores are evaluated against the same contemporaneous preference, including the change boundary. Changing taste uses earlier preferences through observation 30 and new preferences thereafter. Final adaptation at 40 and 60 is reported separately. Mistake windows and subsequent recovery use equal sixty-rating budgets.',
  controls:'Exact explicit ratings, overwrite, removal, restoration, encrypted portability, read-only scoring, user-confirmed and inactive-claim authority, score-order invariance, and unchanged historical defaults. Stored claims stay inspectable and unmodified. At least one development replay must reproduce exactly.',
  gates:{minimumMeanGain:.02,worstDecileDelta:-.01,subgroupLowerDelta:-.01,maxSingleRatingLoss:.05,largeLossRateRatio:.5,
    historicalFinalGain:.03,historicalTotalDecline:-.03,retainedAdaptation:.8},
  selection:'Each supported candidate must independently pass every requirement in both selection and confirmation: two-point final mean gain, positive gain lower bound, worst-tenth and stable/changing/noise subgroup lower bounds within minus one point; contemporaneous mean lower bound within minus one point; no update loss above five points after ten ratings and at least halved large-loss frequency; changing final gain retains 80 percent of positive unrestricted recent gain, and adaptation at forty loses at most one point against current; identical scores across eight rating-order permutations and all contracts. Every historical failure needs three-point final improvement, at most three-point overall decline, and no five-point update loss. No default adoption without passing independent audits and unchanged regression checks.',
  limitations:['Jamie is the only real product user.','Synthetic film ranking does not establish retrieval quality, television behavior, recognition, or question effort.','Different titles are not statistically independent; metadata density is a proxy for duplicate evidence.','Simulated two-day timing does not establish an optimal half-life.','Unavailable preferences cannot be reconstructed from metadata.','Reserved outcomes cannot tune this version or relax its requirements.']};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({fixturePath,protocolPath,viewers:viewers.length}));
