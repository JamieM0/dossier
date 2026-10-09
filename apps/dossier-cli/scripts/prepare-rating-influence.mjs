import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { featureVector } from '@dossier/domain';
import { random, shuffled, key } from './hard-metrics.mjs';
import { INFLUENCE_ARMS, INFLUENCE_CONFIG } from './rating-influence-policy.mjs';
const path='apps/dossier-cli/src/lab/rating-influence-v1.json',protocolPath='apps/dossier-cli/benchmarks/rating-influence-v1-protocol.json';
assert(!existsSync(path)&&!existsSync(protocolPath),'Do not replace frozen inputs; create a new version');
const genres=['Drama','Comedy','Action','Science Fiction','Thriller'];
const tags=['heist','small town','space opera','revenge','ensemble','coming of age','non-linear','grief','survival','satire'];
const types=['stable_axes','interactions','missing_factor','isolated_noise','repeated_noise','biased_noise','changing_taste','weak_ratings','novel_preference','duplicate_evidence','metadata_matched'];
function catalogue(seed,base){
  const next=random(seed);
  const items=Array.from({length:180},(_,i)=>{
    const raw={id:base+i,medium:'movie',title:`Influence ${base} catalogue ${i+1}`,year:1970+Math.floor(next()*55),posterPath:null,
      genres:shuffled(genres,Math.floor(next()*1e8)).slice(0,1+(i%3===0?1:0)),genreIds:[],keywords:shuffled(tags,Math.floor(next()*1e8)).slice(0,2+(i%4===0?1:0)),
      overview:'',runtime:80+Math.floor(next()*80),collection:null,directorIds:[],creatorIds:[],voteAverage:null,voteCount:0,popularity:null};
    return {...raw,features:featureVector(raw)};
  });
  for(let i=11;i<items.length;i+=12)items[i]={...structuredClone(items[i-1]),id:items[i].id,title:items[i].title};
  // A repeated metadata region tests duplicate evidence without repeating a rating key.
  for(let i=70;i<90;i++)items[i]={...structuredClone(items[69]),id:items[i].id,title:items[i].title};
  return items;
}
const catalogues={development:catalogue(261009101,9300000),sealed:catalogue(261009202,9400000),confirmation:catalogue(261009303,9500000)},viewers=[];
const next=random(261009444);
for(const partition of ['development','sealed','confirmation'])for(const type of types)for(let n=0;n<(partition==='development'?4:8);n++){
  const items=catalogues[partition],keys=items.map(key),seed=Math.floor(next()*1e8),rng=random(seed);
  const axes=shuffled(['tone','pacing','complexity','character_focus','thematic_weight'],seed),signs=[rng()<.5?-1:1,rng()<.5?-1:1,rng()<.5?-1:1];
  const selectedTag=tags[Math.floor(rng()*tags.length)],selectedGenre=genres[Math.floor(rng()*genres.length)];
  const craft=Object.fromEntries(keys.map(k=>[k,rng()*2-1]));
  const utility=(item,old=false)=>{
    if(type==='missing_factor'||type==='metadata_matched')return craft[key(item)]*4;
    let u=.7*craft[key(item)]+2*signs[0]*(old?-1:1)*item.features[axes[0]]+1.2*signs[1]*item.features[axes[1]]+.8*signs[2]*item.features[axes[2]];
    if(type==='interactions'&&item.keywords.includes(selectedTag)&&item.genres.includes(selectedGenre))u+=3*signs[2];
    if(type==='novel_preference'&&item.keywords.includes(selectedTag))u+=3*signs[2];
    return u;
  };
  const median=old=>items.map(i=>utility(i,old)).sort((a,b)=>a-b)[90],center=median(false),oldCenter=median(true);
  const rating=u=>Math.abs(u)<.15?0:Math.sign(u)*(type==='weak_ratings'?1:Math.abs(u)>2?3:2);
  viewers.push({id:`influence-${partition}-${type}-${n}`,partition,type,seed,trainingKeys:keys.slice(0,100),holdoutKeys:keys.slice(100),
    ratings:Object.fromEntries(items.map(i=>[key(i),rating(utility(i)-center)])),oldRatings:Object.fromEntries(items.map(i=>[key(i),rating(utility(i,true)-oldCenter)])),
    biasedGenre:selectedGenre,novelTag:selectedTag});
}
writeFileSync(path,JSON.stringify({version:'rating-influence-v1',catalogues,viewers},null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const prior=JSON.parse(readFileSync('apps/dossier-cli/benchmarks/corroboration-v1-protocol.json'));
const protocol={...prior,version:'rating-influence-v1',experiment:11,fixture:{path,sha256:hash(readFileSync(path))},generatorHash:hash(readFileSync('apps/dossier-cli/scripts/prepare-rating-influence.mjs')),
  arms:INFLUENCE_ARMS,candidate:INFLUENCE_CONFIG,seeds:[53,97],totalViewers:viewers.length,selectionViewers:88,confirmationViewers:88,
  hypothesis:'Narrow transfer tests broad similarity; chronological local exceptions test surprising preferences; additive evidence tests denominator redistribution.',
  model:'Three recent candidates only: cosine power eight; cosine power four with contradictory observations restricted to cosine >= .85 using their preceding public history; cosine power four with fixed denominator two. Claims remain unchanged. No fitted settings.',
  actors:'Fresh synthetic people and three separate catalogues. Eleven types include novel preferences, duplicate evidence, metadata-matched opposite tastes, noise and changing taste.',
  selection:'Retain all corroboration gates; evaluate every listed actor type. Compare all three candidates against current, timeless and recent matching. Freeze before reserved evaluation. No tuning against reserved outcomes.',
  controls:prior.controls+' Novel preference learning measures before and after first exposure; unchanged regions and collision ceilings are reported. Fresh confirmation catalogue has disjoint title keys.',
  development:'Use 44 development people with two sessions each. No parameter search is required. Inspect mechanism and learning outcomes before freeze; any revised policy requires a new version.',
  historicalScope:'All new candidate evaluation is synthetic. Five archived synthetic failures add regression coverage. The existing five historical real-data candidate gates remain mandatory and unverified in this version. Synthetic cases cannot waive legacy historical protection. Existing frozen regressions check unchanged product defaults.',
  learningRequirement:'Novel-preference people must show positive mean ranking improvement from observation 30 to 60, alongside subgroup quality and adaptation gates.',
  confirmationCatalogue:'Each partition uses a separate generated catalogue with disjoint title keys. Freeze all sources and criteria before reserved scoring. No tuning after selection or confirmation.'};
writeFileSync(protocolPath,JSON.stringify(protocol,null,2)+'\n');
console.log(JSON.stringify({path,protocolPath,viewers:viewers.length}));
