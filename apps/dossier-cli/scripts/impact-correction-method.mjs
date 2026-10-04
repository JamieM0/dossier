import { lensRuleId } from '@dossier/domain';
import { random } from './hard-metrics.mjs';
export function mainAnswer(person, proposed, rng) {
 const rule=person.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(proposed.conditions));
 let answer='none',effect=rule?.effect,misleading=false;
 if(person.type==='consistent_misleading'&&proposed.conditions.some(p=>p.kind==='axis')){answer='confirm';effect=proposed.effect;misleading=true;}
 else if(person.type==='missing_factor')answer='unknown';
 else if(rng()<person.abstention)answer='unknown';
 else if(rng()<person.responseNoise){answer='confirm';effect=rule?-rule.effect:proposed.effect;misleading=true;}
 else if(rule)answer='confirm';
 return {answer,effect:answer==='confirm'?effect:null,misleading};
}
export function followupAnswer(person, supplied, seed, index) {
 const rng=random(person.seed+seed*21337+index*97);
 const rule=person.rules.find(r=>lensRuleId(r.conditions)===lensRuleId(supplied.question.choices[0].conditions));
 if(person.type==='missing_factor'||rng()<person.abstention)return 'defer';
 if(person.persistent&&supplied.misleading)return 'apply';
 const correct=Boolean(rule&&rule.effect===supplied.effect);
 return rng()<person.followupNoise?(correct?'withdraw':'apply'):(correct?'apply':'withdraw');
}
export const feedbackFrom=answer=>({id:`general:${lensRuleId(answer.question.choices[0].conditions)}`,kind:'general',conditions:answer.question.choices[0].conditions,effect:answer.effect});
export const feedbackArgs=f=>({...f,...('effect'in f?{effect:f.effect>0?'positive':'negative'}:{})});
export function publicItem(r) {
 return {id:r.id,medium:r.medium,title:r.title,year:r.year,posterPath:null,genres:r.genres,genreIds:r.genreIds,
 keywords:r.keywords,overview:r.overview,runtime:r.runtime,collection:r.collection,directorIds:r.directorIds,creatorIds:r.creatorIds,
 features:r.features,voteAverage:null,voteCount:0,popularity:null};
}
