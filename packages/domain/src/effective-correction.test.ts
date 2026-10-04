import { expect, test } from 'vitest';
import { AXIS_KEYS, type FeatureVector } from './lens.js';
import { emptyCorrections, setCorrection, removeCorrection, scoreCorrections, readCorrections } from './effective-correction.js';
import type { TmdbItem } from './tmdb/types.js';
const items:TmdbItem[]=Array.from({length:5},(_,i)=>({id:i+1,medium:'movie',title:`Film ${i}`,year:2020,posterPath:null,
 overview:'',genres:['Drama'],genreIds:[],keywords:i<2?['heist','ensemble']:[],directorIds:[],creatorIds:[],collection:null,
 voteAverage:null,voteCount:0,popularity:null,runtime:null,features:Object.fromEntries(AXIS_KEYS.map(a=>[a,i<2?.9:.3])) as FeatureVector}));
const entries=items.slice(0,4).map((item,i)=>({item:{...item,key:`movie:${item.id}`},rating:(i<2?3:-3) as 3|-3,ts:100+i}));
const scores=(state:ReturnType<typeof emptyCorrections>)=>Object.fromEntries(scoreCorrections(items,entries,[],state,'scoped').map(r=>[`movie:${r.item.id}`,r.score]));
test('general correction changes its scope and removal restores inference',()=>{
 const initial=emptyCorrections(),before=scores(initial);
 const first=setCorrection(initial,{id:'rule',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:1});
 const corrected=setCorrection(first,{id:'rule',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:-1});
 expect(scores(first)['movie:1']).toBeGreaterThan(0);expect(scores(corrected)['movie:1']).toBeLessThan(0);
 expect(scores(corrected)['movie:3']).toBe(before['movie:3']);
 expect(scores(removeCorrection(corrected,'rule'))).toEqual(before);
 expect(setCorrection(first,{...first.feedback[0],id:'new'}).feedback).toHaveLength(1);
});
test('specific preference and title exception take precedence, ambiguous general rules abstain',()=>{
 let state=setCorrection(emptyCorrections(),{id:'a',kind:'general',conditions:[{kind:'tag',value:'heist'}],effect:1});
 state=setCorrection(state,{id:'b',kind:'general',conditions:[{kind:'tag',value:'ensemble'}],effect:-1});
 const row=scoreCorrections(items,entries,[],state,'scoped').find(r=>r.item.id===1)!;
 expect(row.correctionEvidence.conflicts).toEqual(['a','b']);
 expect(row.score).toBe(scores(emptyCorrections())['movie:1']);
 state=setCorrection(state,{id:'specific',kind:'general',conditions:[{kind:'tag',value:'heist'},{kind:'tag',value:'ensemble'}],effect:1});
 expect(scores(state)['movie:1']).toBeGreaterThan(0);
 state=setCorrection(state,{id:'exception',kind:'exception',key:'movie:1',effect:-1});
 expect(scores(state)['movie:1']).toBeLessThan(0);expect(scores(state)['movie:2']).toBeGreaterThan(0);
});
test('comparisons honor chains, reverse the same pair, and expose cycles without changing unrelated scores',()=>{
 let state=emptyCorrections();const before=scores(state);
 for(const [winner,loser]of [['movie:5','movie:4'],['movie:4','movie:3'],['movie:3','movie:2']])state=setCorrection(state,{id:winner,kind:'comparison',winner,loser});
 const actual=scores(state);expect(actual['movie:5']).toBeGreaterThan(actual['movie:4']!);expect(actual['movie:4']).toBeGreaterThan(actual['movie:3']!);
 expect(actual['movie:3']).toBeGreaterThan(actual['movie:2']!);expect(actual['movie:1']).toBe(before['movie:1']);
 state=setCorrection(state,{id:'reverse',kind:'comparison',winner:'movie:2',loser:'movie:3'});
 expect(state.feedback).toHaveLength(3);
 state=setCorrection(state,{id:'cycle1',kind:'comparison',winner:'movie:3',loser:'movie:5'});
 state=setCorrection(state,{id:'cycle2',kind:'comparison',winner:'movie:5',loser:'movie:2'});
 const rows=scoreCorrections(items,entries,[],state,'scoped');expect(rows.some(r=>r.correctionEvidence.conflicts.length)).toBe(true);
 expect(Object.fromEntries(rows.map(r=>[`movie:${r.item.id}`,r.score]))).toEqual(before);
});
test('invalid correction state cannot enter a scorer',()=>{
 expect(()=>readCorrections({version:1,feedback:[{id:'x',kind:'exception',key:'movie:0',effect:1}]})).toThrow();
 expect(()=>setCorrection(emptyCorrections(),{id:'x',kind:'general',conditions:[{kind:'axis',value:'fake',side:'high'}],effect:1})).toThrow();
});
