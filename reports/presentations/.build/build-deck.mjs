import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation,PresentationFile } from '@oai/artifact-tool';
const root='/Users/jamie/Developer/dossier';
const workspaceDir=path.join(root,'reports/presentations');
const build=path.join(workspaceDir,'.build');
const SKILL_DIR='/Users/jamie/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const RUNTIME_PYTHON='/Users/jamie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const {resolvePresentationFont,applyPresentationChartFont,finalizePresentation}=await import(pathToFileURL(path.join(SKILL_DIR,'container_tools/artifact_tool_utils.mjs')));
const body=resolvePresentationFont({fontFamily:'Avenir Next'}),heading=resolvePresentationFont({fontFamily:'Iowan Old Style'});
const read=async p=>JSON.parse(await fs.readFile(path.resolve(root,p),'utf8'));
const hard=await read('/tmp/dossier-hard-baseline.json');
const easy=await read('/tmp/dossier-lab-final.json');
const live=await read('/tmp/dossier-live-validation.json');
const real=await read('reports/dossier-real-v1-baseline.json');
const tmdb=await read('reports/dossier-learning-study-tmdb.json');
const conf=await read('reports/reviews-plus-tags-confirmation-v1.json');
const diagnosis=await read('reports/backwards-learning-diagnosis-v1.json');
const guard=await read('reports/observed-rating-override-decision-v1.json');
const paper='#F2EFE8',ink='#17252B',muted='#5C6C70',red='#BC432A',green='#397564',blue='#55718E',line='#D7D0C4';
const p=Presentation.create({slideSize:{width:1280,height:720}});
p.theme.colorScheme={name:'Dossier evidence',themeColors:{accent1:green,accent2:red,accent3:blue,accent4:'#BA9152',accent5:'#87798F',accent6:'#8C9A90',bg1:paper,bg2:'#FFFFFF',tx1:ink,tx2:muted,dk1:'#000000',dk2:ink,lt1:'#FFFFFF',lt2:paper,hlink:blue,folHlink:blue}};
const ledger=[],tableOwners=[],chartOwners=[];
const pct=n=>(n*100).toFixed(1)+'%';
const likes=n=>(n*10).toFixed(2);
function text(s,t,x,y,w,h,size=27,color=ink,bold=false,family=body){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=t;a.text.style={typeface:family,fontSize:size,color,bold,autoFit:'none',verticalAlignment:'top',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};
 return a;
}
function slide(title,{dark=false,sub='',notes='',source=''}={}){
 const s=p.slides.add();s.background.fill=dark?ink:paper;
 const n=p.slides.items.length;
 text(s,title,72,46,1136,106,44,dark?paper:ink,false,heading);
 if(sub)text(s,sub,72,148,1100,58,24,dark?'#CAD7D3':muted);
 text(s,String(n).padStart(2,'0'),1150,675,58,24,17,dark?'#C5D1CD':muted,false,body);
 s.speakerNotes.textFrame.setText((notes?notes+'\n\n':'')+'Sources: '+source);
 ledger.push({slide:n,title,notes,source});return s;
}
function paragraphs(s,rows,{y=220,size=29,gap=120,color=ink,x=72,w=1100}={}){
 for(let i=0;i<rows.length;i++)text(s,rows[i],x,y+i*gap,w,gap-18,size,color);
}
function conclusion(s,t,y=589){text(s,t,72,y,1100,66,27,green,true);}
function table(s,values,{y=210,h=310,widths,highlight=[],font=25,x=72,w=1136}={}){
 const tb=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,...(widths?{columnWidths:widths}:{})});
 tb.styleOptions={headerRow:false,bandedRows:false};
 tb.borders.assign({style:'solid',fill:line,width:.5});
 const cellstyle={typeface:body,fontSize:font,color:ink,verticalAlignment:'middle',autoFit:'none',insets:{left:12,right:12,top:2,bottom:2}};
 for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
  const cell=tb.getCell(r,c);cell.fill=r===0?ink:paper;cell.text.style={...cellstyle,color:r===0?paper:ink,bold:r===0||c===0};
  if(highlight.includes(r)){cell.fill='#E4ECE7';cell.text.style={...cellstyle,bold:true};}
 }
 for(let r=0;r<values.length;r++)tb.rows[r].height=h/values.length;
 tableOwners.push(p.slides.items.length);return tb;
}
function chart(s,type,cfg){const c=s.charts.add(type,cfg);applyPresentationChartFont(c,{fontFamily:body});chartOwners.push(p.slides.items.length);return c;}
const source={easy:'/tmp/dossier-lab-final.json; /tmp/dossier-sensitivity.json; reports/dossier-hard-v1-baseline.html (legacyInvestigation)',hard:'reports/dossier-hard-v1-baseline.html (embedded report-data)',live:'/tmp/dossier-live-validation.json; reports/dossier-hard-v1-baseline.html (legacyInvestigation)',real:'reports/dossier-real-v1-baseline.json',tmdb:'reports/dossier-learning-study-tmdb.json',study:'reports/dossier-learning-study.json; reports/dossier-learning-study-bundled.json; reports/dossier-learning-study-tmdb.json',conf:'reports/reviews-plus-tags-confirmation-v1.json',diag:'reports/backwards-learning-diagnosis-v1.json',guard:'reports/observed-rating-override-decision-v1.json; apps/dossier-cli/benchmarks/override-v1-protocol.json'};
let s;
// 1
s=slide('Learning a person’s taste',{dark:true,source:source.study+'; '+source.conf+'; '+source.guard});
text(s,'What we tested, what we learned,\nand what should happen next',72,233,900,140,36,paper);
text(s,'Dossier experiment review\n2 October 2026',72,530,900,80,23,'#CAD7D3');
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'apps/dossier-desktop/assets/logo.png'))),contentType:'image/png',alt:'Dossier logo',fit:'contain',position:{left:1040,top:495,width:150,height:150}});
// 2
s=slide('The findings that matter most',{source:source.tmdb+'; '+source.conf+'; '+source.guard,notes:'The references use different cohorts and checkpoints. We compare methods within each experiment. We do not infer a trend in model quality from changes between cohorts. Product defaults remain unchanged.'});
paragraphs(s,['Public reviews beat current Dossier on average in the real-viewer tests.','Reviews plus tags adds a small average benefit. Some people still do much better with current Dossier.','We cannot yet reliably identify those people from limited ratings.'],{y:210,gap:125,size:30});
conclusion(s,'The evidence supports further experiments. Product defaults stay unchanged.',602);
// 3
s=slide('The product question',{source:'User brief; docs/simulation-lab.md; docs/confirmation-experiment.md'});
text(s,'Does Dossier learn what this person likes\nfrom the few ratings they are willing to give?',72,218,1110,150,42,ink,false,heading);
paragraphs(s,['A useful model should suggest more films that person enjoys.','New ratings should refine mistaken assumptions without damaging the recommendations.'],{y:405,gap:100,size:29});
// 4
s=slide('How the experiments work',{source:'docs/hard-benchmark.md; docs/real-benchmark.md; docs/override-experiment.md',notes:'The runner creates disposable profiles and uses the same CLI action handlers as normal CLI use. The catalogue adapter supplies public film details. Only training ratings enter Dossier. Hidden ratings score the completed output. All later studies use fixed evidence orders and repeatable fixtures.'});
paragraphs(s,['1. Start with a person whose film ratings we already know.','2. Give Dossier only some of those ratings through the CLI.','3. Ask it to rank films whose personal ratings we kept hidden.','4. Compare the ranking with those hidden answers.'],{y:205,gap:85,size:28});
conclusion(s,'The hidden answers score the result. They do not train Dossier.',586);
// 5
s=slide('What the two main scores mean',{source:'apps/dossier-cli/scripts/hard-metrics.mjs; apps/dossier-cli/scripts/real-metrics.mjs',notes:'Ordering score is ranking AUC. It compares every clear liked/disliked pair, with ties worth half. Neutral ratings do not enter it. An unavailable ranking scores 50%. Clear likes among ten suggestions use the first ten recommendations and score missing recommendations as zero. Neither score is a calibrated prediction of a star rating. Four or more MovieLens stars count as clear likes. At most 2.5 stars count as dislikes.'});
text(s,'Ordering score',72,220,530,55,33,ink,true);
text(s,'Does a film the person likes appear ahead of a film they dislike?',72,295,510,110,29);
text(s,'76% means the liked film comes first\nin 76 out of 100 comparisons.\n50% means chance ordering.',72,435,510,135,27,muted);
text(s,'Liked films among ten suggestions',675,220,530,90,33,ink,true);
text(s,'How many of the first ten films\ndid the person clearly like?',675,325,510,100,29);
text(s,'6.5 means about six or seven liked\nfilms per ten suggestions, on average.',675,460,510,100,27,muted);
conclusion(s,'Higher is better for both. A 76% ordering score does not mean a 76% chance of enjoyment.',605);
// Definitions
s=slide('What the methods mean',{source:source.study+'; docs/real-benchmark.md'});
table(s,[['Method','What it does'],['Current Dossier','Uses your ratings to learn film styles, groups and claims about your taste'],['Public reviews','Ranks films by their published average audience rating'],['Reviews plus tags','Gives public ratings 75% of the score and personal genre/keyword matching 25%'],['CLI','A command tool that lets the experiment add ratings and inspect Dossier automatically']],{y:215,h:398,widths:[340,796],font:26});
// 6
s=slide('The sequence of experiments',{source:Object.values(source).join('; '),notes:'This is the sequence of test designs. Repeated runs and implementation parity checks support each design but do not count as new independent people.'});
table(s,[['Experiment','Why we ran it'],['Invented people and films','Check the pipeline, then expose harder tastes'],['Real films and recorded viewer ratings','Remove answers built from our own assumptions'],['Updated film descriptions and model comparisons','Find what drives the real-viewer gap'],['Fixed reviews-plus-tags method on new viewers','Check whether a small benefit repeats'],['Known failures and a protection rule','Protect personal tastes without restoring large losses']],{h:420,y:202,widths:[450,686],font:25});
// 7
s=slide('The first tests looked unusually strong',{source:source.easy,notes:'The large synthetic run contains 24 designed profiles and 240 variations, with four clone trials per person. Variations share the designed profile rules and are not 264 independent real people. The single-person sensitivity example has 20 hidden films. Ten coherent ratings score 95%, reversing five of those ratings scores 57%. The easy oracle shares feature axes with Dossier. Simple cosine matching scores 99.17% after one rating in the later investigation.'});
text(s,'98%',72,215,370,130,92,green,true);
text(s,'ordering score after one rating\nfor the easy sci-fi person',72,350,500,105,28);
text(s,'10 of 10',690,215,490,130,76,green,true);
text(s,'suggestions liked by that person\nafter ten ratings',690,350,490,105,28);
text(s,'The larger run also found 8.86 liked films per ten after 20 ratings.',72,482,1100,65,29);
conclusion(s,'The answers used many of the same film properties as Dossier. The test was too easy.',587);
// 8
s=slide('The CLI really changed the model',{source:source.live,notes:'We rated ten known films, inspected recommendations, claims, explanations, calibration questions and taste areas, then added a positive Avengers: Infinity War rating. The ten recommended film identities stayed the same, but their scores and order changed. Six remaining negative claims weakened, one disappeared, and the rating queue changed. A clean replay matched before and after. CLI profiles are separate from the GUI library, so this did not establish shared live UI state.'});
paragraphs(s,['We added ten ratings, inspected the model, then added a contradictory positive rating for Avengers: Infinity War.','The model changed. Its inferred claims fell from 13 to 12, other claims weakened, and film scores changed.','The same ten films remained in the recommendations. Scores moved, but no new film entered the first ten.'],{y:205,gap:125,size:28});
conclusion(s,'A clean repeat matched. A working pipeline still needed a harder quality test.',604);
// 9
s=slide('Harder invented tastes exposed weaknesses',{source:source.hard,notes:'18 fixed people, 288 invented films, 72 hidden films per person, four rating orders. Personas include split tastes, genre exceptions, director loyalty, franchises, broad and selective tastes, unreliable raters, mood-dependent tastes, subtle distinctions and misleading starts. The adapter builds Dossier features from public fields. Some hidden preferences depend on unavailable properties, which intentionally tests representation limits.'});
text(s,'18 people\n288 invented films\n72 hidden films per person',72,220,510,200,36,ink,true);
paragraphs(s,['Likes horror, but avoids gore.','Follows one director across very different films.','Likes two very different kinds of film, with little in between.'],{x:675,w:500,y:220,gap:120,size:28});
conclusion(s,'These were useful stress tests. They still could not tell us how real viewers behave.',603);
// 10
s=slide('Dossier learned, but simple matching competed',{sub:'Harder invented people, after 20 ratings',source:source.hard,notes:'At 20 ratings Dossier AUC 0.7612, nearest baseline 0.7537, genre 0.7165, vector 0.6408, popularity 0.5669, random 0.5334. Precision10 0.4264 and 0.45 for nearest. Dossier improves from 0.5391 at one rating to 0.8045 at forty, averaged across all people and orders. This is not a direct comparison with the later real-film cohorts.'});
table(s,[['Ranking method','Ordering score','Liked films per ten'],['Current Dossier',pct(hard.learning[20].dossier.auc.mean),likes(hard.learning[20].dossier.precision10.mean)],['Match similar rated films',pct(hard.learning[20].nearest.auc.mean),likes(hard.learning[20].nearest.precision10.mean)],['Learn preferred genres',pct(hard.learning[20].genre.auc.mean),likes(hard.learning[20].genre.precision10.mean)],['Popularity',pct(hard.learning[20].popularity.auc.mean),likes(hard.learning[20].popularity.precision10.mean)]],{y:225,h:300,widths:[526,275,335],highlight:[1]});
conclusion(s,'Dossier improved with more ratings, but its extra complexity did not win on every measure.',573);
// 11
s=slide('The same invented person could get different lists',{source:source.easy+'; '+source.hard,notes:'The early clone test varies the evidence supplied to four copies of each synthetic person. Mean pairwise top-ten overlap is 0.633 and mean pairwise hit-rate difference 0.074. This mixes different film evidence and evidence order. It does not isolate order alone. Later diagnostic replay isolates order using identical forty-rating libraries and fixed claims.'});
text(s,'About 6 of 10 films',72,220,1100,90,56,ink,false,heading);
text(s,'remained the same between recommendation lists for copies of the same person.',72,330,1050,110,30);
text(s,'Different early ratings could lead Dossier toward different versions of someone’s taste.',72,474,1100,100,31);
conclusion(s,'We needed to check whether those differences persist with real ratings.',599);
// 12
s=slide('Real films and real recorded ratings',{source:source.real+'; docs/real-benchmark.md',notes:'MovieLens 2018 latest-small source. Every viewer with at least 150 matched ratings and forty clear likes and dislikes joins the original cohort. The catalogue contains 1,736 films. Each of the thirty-one viewers has sixty hidden films and four seeded learning orders. Film matches use exact release year and normalized title, excluding ambiguous matches. These are historical anonymous viewers, not thirty-one people recruited to use Dossier today.'});
text(s,'31 viewers\n1,736 films\n60 hidden films per viewer',72,220,550,220,39,ink,true);
paragraphs(s,['MovieLens is an archive of film ratings from real people. We used their recorded answers.','Dossier saw only the ratings we revealed.','Each person supplied ratings in four different orders.'],{x:690,w:480,y:222,gap:110,size:28});
conclusion(s,'The personal answers now came from people, independently of Dossier’s film descriptions.',596);
// 13
s=slide('Public reviews beat the current model',{sub:'Real viewers with the original bundled film descriptions, after 20 ratings',source:source.real,notes:'The bundled BestSimilar film catalogue has sparse director and collection fields. This is the original real-v1 benchmark, not the later TMDB catalogue. Other MovieLens viewer means score 82.13% and 6.61 likes but use information unavailable to Dossier. The deck keeps that comparison in the appendix.'});
table(s,[['Ranking method','Ordering score','Liked films per ten'],['Current Dossier',pct(real.learning[20].dossier.auc.mean),likes(real.learning[20].dossier.precision10.mean)],['Public reviews',pct(real.learning[20].public_rating.auc.mean),likes(real.learning[20].public_rating.precision10.mean)],['Popularity',pct(real.learning[20].popularity.auc.mean),likes(real.learning[20].popularity.precision10.mean)],['Match similar rated films',pct(real.learning[20].nearest.auc.mean),likes(real.learning[20].nearest.precision10.mean)]],{y:225,h:300,widths:[526,275,335],highlight:[2]});
conclusion(s,'Public reviews found almost two more liked films per ten than current Dossier.',582);
// 14
s=slide('Better film information did not close the gap',{sub:'TMDB is a public database of film details and audience ratings.',source:source.study,notes:'We freeze viewer identities, rating splits and evidence orders while replacing bundled descriptions with retrieved TMDB genres, keywords, overviews, public reviews, directors and collection information. 1,735 director records and 477 collections. Dossier AUC20 changes 61.13% to 59.24%. Public review ordering changes 82.31% to 80.67%. This controlled result does not establish that one metadata source is generally better. Model parameters did not change. The TMDB study is the frozen regression reference.'});
table(s,[['After 20 ratings','Bundled descriptions','Updated TMDB details'],['Current Dossier',pct(real.learning[20].dossier.auc.mean),pct(tmdb.learning[20].dossier.auc.mean)],['Public reviews',pct(real.learning[20].public_rating.auc.mean),pct(tmdb.learning[20].public_rating.auc.mean)]],{y:220,h:235,widths:[460,338,338]});
text(s,'The same people and hidden ratings remained in the test. We changed the public film information.',72,491,1100,100,30);
conclusion(s,'Missing film details were not enough to explain the weak recommendations.',602);
// 15
s=slide('More ratings helped slowly on average',{sub:'The fixed TMDB comparison test, 31 viewers',source:source.tmdb,notes:'Dossier learning checkpoints 52.98%,54.94%,56.53%,57.6%,59.24%,60.18%. Public reviews 80.67%, unchanged by evidence count. More evidence improves the mean, but thirty-five of 124 sessions lose more than three AUC points between ten and forty ratings, across twenty-four viewers. Sparse profiles can return no recommendations. Ordering AUC then uses chance at 50%, while first-ten likes count missing output as zero.'});
chart(s,'line',{position:{left:75,top:225,width:1120,height:320},categories:['1','3','5','10','20','40'],series:[{name:'Current Dossier',values:[1,3,5,10,20,40].map(n=>tmdb.learning[n].dossier.auc.mean),line:{fill:red,width:4},marker:{symbol:'circle',size:8}},{name:'Public reviews',values:[1,3,5,10,20,40].map(n=>tmdb.learning[n].public_rating.auc.mean),line:{fill:green,width:4},marker:{symbol:'none'}}],hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:22,fill:ink}},xAxis:{title:{text:'Ratings supplied',textStyle:{fontSize:22}},textStyle:{fontSize:22,fill:ink},line:{fill:line,width:1}},yAxis:{min:.5,max:1,majorUnit:.1,numberFormatCode:'0%',textStyle:{fontSize:22,fill:ink},majorGridlines:{fill:line,width:1},title:{text:'Ordering score',textStyle:{fontSize:22}}},chartFill:paper,plotAreaFill:paper});
conclusion(s,'35 of 124 sessions got worse between 10 and 40 ratings. The average hides those losses.',595);
// 16
s=slide('Claims often corrected, but rankings still failed',{source:source.hard+'; '+source.tmdb,notes:'Hard synthetic belief tests: three correctly removed, two overcorrected, five total. TMDB real tests: 25 correctly removed, one correctly replaced, two overcorrected, three no false claim formed. Eligible denominator twenty-eight, so 26/28=92.86%. Tests deliberately construct biased evidence, then add matching contradictory training ratings. No claim-correction percentage is a measure of all inferred claims or all user preferences. Narrowing may happen through other claims but primary classifications are removal/replacement here.'});
text(s,'26 of 28',72,220,650,100,70,green,true);
text(s,'wrong early claims corrected after contradictory real ratings',72,331,1080,100,32);
text(s,'Two cases went too far. Three other viewers never formed a wrong claim in the first place.',72,472,1100,96,28);
conclusion(s,'Correcting a statement about taste does not guarantee better film recommendations.',600);
// 17
s=slide('Dossier’s questions did not teach it faster',{sub:'The fixed TMDB comparison test, after 40 total ratings',source:source.tmdb+'; '+source.hard,notes:'Calibration arms share five initial ratings and later rate either Dossier-chosen unseen training titles or randomly selected titles from the more popular 75% of the unseen pool. Both arms score the same sixty hidden films. At 40, active AUC .5806 and reasonable random .6189. Viewer-bootstrap difference -.0383, 95% interval -.0769 to -.0005. At 20 interval crosses zero. Hard synthetic at 20 +0.0071 but at40 -.0122. Bundled real at40 -.0111. We always reveal the recorded rating; recognition and willingness to answer are not tested.'});
table(s,[['Who chooses the next film?','Ordering score'],['Dossier’s rating queue','58.1%'],['Random choice from reasonably popular films','61.9%']],{y:220,h:240,widths:[820,316]});
text(s,'Both started with the same five ratings and used the same hidden films for scoring.',72,493,1100,75,29);
conclusion(s,'The current question strategy does not earn its complexity in this test.',600);
// 18
s=slide('Damaged ratings usually damaged the result',{sub:'Change in ordering score in the fixed TMDB comparison test',source:source.tmdb+'; '+source.real+'; '+source.hard,notes:'TMDB damage summary means: half reversed -.0690, randomized -.1101, important removed -.0471, contradictions -.0338, twenty reduced to five -.0307. All aggregate sensitivity flags pass the predefined threshold, but many individual results remain unchanged or improve. Bundled real contradiction and five-rating conditions fall below the three-point sensitivity threshold. Hard invented cohort degradation is larger: -25.55,-32.74,-22.14,-25.22,-20.54 points. Damage trials score current Dossier, not the fixed 75/25 candidate.'});
table(s,[['Damage to supplied evidence','Average change'],['Reverse half the ratings','−6.9 points'],['Shuffle ratings between films','−11.0 points'],['Remove important ratings','−4.7 points'],['Add contradictory ratings','−3.4 points'],['Reduce 20 ratings to five','−3.1 points']],{y:215,h:375,widths:[850,286],font:25});
text(s,'The test reacts to bad evidence. Some individuals still improve when evidence gets worse.',72,609,1100,50,25,green,true);
// 19
s=slide('Public reviews drove the strongest alternatives',{sub:'Same 31 viewers and hidden films, after 20 ratings',source:source.study,notes:'TMDB model component comparisons: current .5924, no claims .5913, no groups .5895, no groups/no claims .5834, no dislike penalty .5714, no negative signals .5699, increased quality .7498, public .8067, reviews plus lens similarity .7907, tags alone .5780, reviews plus tags .8126. Eleven methods are exploratory, selected on the same data. The .0059 average candidate gain does not independently confirm improvement. Removing claims, groups, or negatives globally does not solve the average gap and may harm useful individual effects.'});
table(s,[['Method','Ordering score'],['Current Dossier','59.2%'],['Dossier without inferred claims','59.1%'],['Dossier with much more weight on reviews','75.0%'],['Public reviews alone','80.7%'],['75% reviews and 25% genre/tag matching','81.3%']],{y:216,h:355,widths:[850,286],highlight:[5],font:25});
text(s,'The 0.6-point gain was small and exploratory. We needed a separate viewer check.',72,600,1100,65,28,green,true);
// 20
s=slide('A small benefit repeated on 47 new viewers',{sub:'Same fixed 75/25 method, after 20 ratings',source:source.conf,notes:'47 previously unused viewers from the same MovieLens archive and same 1,736-film TMDB catalogue. Sixty fixed hidden films each, four orders. Public AUC .7288 and precision .6532; candidate .7383/.6777; Dossier .6007/.5133. Paired candidate-public mean AUC gain .0095 (reported rounded), interval .0033 to .0160. Top-ten precision gain .0245, interval .0085 to .0415. One viewer loses over three AUC points vs public, six gain. No average individual loss reaches one like/ten vs public. This is confirmation on new individuals, not an independent population.'});
table(s,[['Method','Ordering score','Liked films per ten'],['Public reviews','72.9%','6.53'],['Fixed reviews plus tags','73.8%','6.78'],['Current Dossier','60.1%','5.13']],{y:225,h:245,widths:[526,275,335],highlight:[2]});
text(s,'About one ranking point better than public reviews.\nThe likely gain is 0.3 to 1.6 points.',72,505,1100,85,29);
conclusion(s,'About one extra liked film for every 40 suggestions, on average in this test.',610);
// 21
s=slide('The average benefit hides people who lose',{sub:'Two viewers from the 47-person check, after 20 ratings',source:source.conf,notes:'Viewer82 current AUC .8301, candidate .5559, public .4835. Viewer484 current .6903, candidate .5225, public .5023. Eight unusual-taste viewers are defined using public-review ordering <=.6 on the full training pool, never hidden labels. Candidate-public group gain .0103, 95% interval -.009 to .0313. Four individuals lose over three points against current Dossier in the full confirmation cohort. First-ten counts and full ordering can disagree: viewer484 candidate has .75 more likes per ten despite worse overall ordering.'});
chart(s,'bar',{position:{left:70,top:228,width:1110,height:310},categories:['Viewer 82','Viewer 484'],series:[{name:'Current Dossier',values:[.8301,.6903],fill:blue,valuesFormatCode:'0.0%'},{name:'Reviews plus tags',values:[.5559,.5225],fill:green,valuesFormatCode:'0.0%'}],barOptions:{direction:'column',grouping:'clustered',gapWidth:90},hasLegend:true,legend:{position:'bottom',textStyle:{fontSize:22,fill:ink}},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:23,fill:ink,bold:true}},xAxis:{textStyle:{fontSize:23,fill:ink},majorGridlines:null},yAxis:{min:0,max:1,majorUnit:.2,numberFormatCode:'0%',textStyle:{fontSize:20,fill:ink},majorGridlines:{fill:line,width:1}},chartFill:paper,plotAreaFill:paper});
conclusion(s,'A universal switch would throw away useful personalisation for these viewers.',602);
// 22
s=slide('The five worst learning declines reproduced',{sub:'Ordering score in current Dossier with more real ratings',source:source.diag+'; '+source.tmdb,notes:'Five largest frozen 10-to40 declines selected before new-viewer scoring. Exact replay through actual CLI after every rating and additive score reconstruction. Viewer21 seed83 .6721-.3766;177/11 .7937-.5547;483/83 .5114-.2828;21/11 .6867-.4627;603/29 .7041-.4898. Four distinct people, five evidence orders. Do not describe them as five independent users.'});
table(s,[['Viewer and rating order','After 10 ratings','After 40 ratings'],...diagnosis.cases.map(c=>['Viewer '+c.viewer.split('-').at(-1)+' / order '+c.seed,pct(c.auc10),pct(c.auc40)])],{y:216,h:360,widths:[526,305,305],font:25});
conclusion(s,'These are large losses for particular people. The current model can learn backwards.',602);
// 23
s=slide('New evidence can spread to the wrong films',{source:source.diag,notes:'Exact score decomposition and all eight before/after component combinations establish mechanisms in these frozen cases. Viewer483/83 like Fellowship count12 changes groups and helps disliked FantasticFour over liked Adaptation. Omitting newly formed liked groups recovers much of the single-step loss. Viewer21/11 dislike TwoTowers count26 creates a disliked group and puts ItTakesTwo before liked TotalRecall. Holding prior dislike contribution nearly restores that step. These diagnostic interventions use earlier snapshots and hidden outcomes to explain failure, not to choose deployed recommendations.'});
text(s,'A new like can boost the wrong film',72,216,530,94,34,ink,true);
text(s,'Liking The Fellowship of the Ring\nboosts disliked Fantastic Four\nahead of liked Adaptation.',72,340,510,155,30);
text(s,'A new dislike can penalise a favourite',680,216,520,100,34,ink,true);
text(s,'Disliking The Two Towers\npushes disliked It Takes Two\nahead of liked Total Recall.',680,340,510,155,30);
conclusion(s,'Broad film similarities reach too far. More ratings can strengthen the wrong match.',592);
// 24
s=slide('Rating order changes the final model too',{source:source.diag,notes:'Twelve shuffled input orders of the same final forty ratings, with the final claim set held fixed. This isolates order sensitivity in buildTasteSpace grouping. Viewer603 min .4469,max .5755 is 12.86 points. Other cases range 7.15,7.82,7.71,5.35 points approximately. It does not include claim-update order effects because those are held fixed.'});
text(s,'44.7% to 57.6%',72,220,1120,100,72,red,true);
text(s,'One viewer’s ordering score across different orders\nof the same 40 ratings.',72,351,1100,112,32);
text(s,'We held the inferred claims fixed. The film-grouping step still produced different recommendations.',72,506,1100,110,30);
// 25
s=slide('The proposed protection rule',{source:source.guard,notes:'Fixed before hidden outcome scoring: unchanged candidate by default, current Dossier only after >=20 supplied ratings, >=6 likes, >=6 dislikes, supplied public AUC <=.6. Three stratified folds repeated at seeds101,211,307. Current must beat candidate and public by >=.05 in every repeat and both 95% title-bootstrap lower bounds >0. Hidden answers and viewer IDs do not enter decision. Thirty untouched viewers with forty hidden films, previous78 viewers included. Models unchanged.'});
paragraphs(s,['Start with the unchanged 75% reviews / 25% tags ranking.','Temporarily hide some ratings the person already supplied. Test whether current Dossier predicts them better.','Switch only if that advantage repeats. Require at least 20 ratings, six likes, and six dislikes.'],{y:210,gap:128,size:29});
conclusion(s,'We kept this rule unchanged, then tested 30 new viewers and the 78 previous viewers.',606);
// 26
s=slide('The protection rule missed the people it needed',{source:source.guard,notes:'Primary checkpoint40. Zero of120 fresh sessions selected. Nineteen current-model opportunities >.03 AUC in nine fresh viewers missed. Eighty-six sessions blocked by balanced evidence minimum, twenty-six by public-agreement condition, eight by unreliable repeated validation. Sixteen new viewers have fewer than six clear dislikes/likes in their full training pool because holdout reserves dislikes. These cohort/split limitations qualify sensitivity. Across all432 sessions one confirmation viewer292/order11 switches at40 and gains4.33 points vs candidate. Viewer82 four dislikes,484two or three after40.'});
text(s,'0 of 120',72,218,580,110,76,red,true);
text(s,'new-viewer sessions chose\na personal override after 40 ratings',72,350,570,110,29);
text(s,'19 missed opportunities',690,222,500,110,44,ink,false,heading);
text(s,'Current Dossier would rank the hidden films at least three points better in those sessions.',690,361,495,122,30);
conclusion(s,'The six-dislike requirement blocks viewers 82 and 484. It misses the people we need to protect.',604);
// 27
s=slide('The fixed alternative avoided large losses',{source:source.guard+'; '+source.diag,notes:'All five exact current-model failures reproduce unchanged. The guard falls back to unchanged candidate throughout those failures. At forty candidate gains13.06 to47.98 points over current. Four cases meet all predefined checks. Viewer483/83 guard10 .7955,guard40 .7626 declines3.29 points, just over three-point limit. Largest individual step loss acrossfive1.95 points, below five-point threshold. This is no evidence the internal Dossier mechanism changed. Recommendation defaults unchanged because exception detection fails regardless of this near-boundary decline.'});
table(s,[['Known session','Current Dossier, 40 ratings','Fixed alternative, 40 ratings'],...guard.failures.map(f=>['Viewer '+f.viewer.split('-').at(-1)+' / order '+f.seed,pct(f.current40),pct(f.guard40)])],{y:216,h:354,widths:[520,308,308],font:24});
text(s,'All five avoid the large original losses. One still loses 3.3 points as ratings increase.',72,601,1100,67,27,green,true);
// 28
s=slide('What the results mean for someone using Dossier',{source:source.tmdb+'; '+source.conf+'; '+source.guard,notes:'These are implications drawn from objective retrospective results, not a claim of observed product-user outcomes. Average public-review superiority does not negate individual current-model wins. Mechanism diagnosis and failed detection imply defaults should remain unchanged pending protection.'});
paragraphs(s,['Most tested viewers would receive better suggestions from a ranking that gives public reviews much more weight.','A person with unusual taste may lose the recommendations that make Dossier feel personal.','Adding more ratings or answering Dossier’s questions does not reliably prevent that loss.'],{y:215,gap:126,size:30});
conclusion(s,'Dossier needs to recognise when personal ratings should outweigh the public consensus.',604);
// 29
s=slide('What these experiments cannot tell us',{source:'docs/real-benchmark.md; docs/confirmation-experiment.md; docs/override-experiment.md',notes:'Cohorts are selected historical MovieLens users who rated available matched catalogue films. Metadata/public scores postdate personal ratings. Repeated evidence orders are not independent users. Hidden film splits include class-balanced selections. We measure ordering among rated films, not full catalogue retrieval, question recognition, actual product engagement, future taste, mood, or complete explainability. Later cohorts have different eligibility and hidden counts; scores are comparable acrossmethods within each study, not trend claims acrosscohorts.'});
paragraphs(s,['The real viewers come from one historical ratings source. We have not tested people using Dossier today.','We rank films they already chose to rate. We have not tested every unseen film or the whole discovery experience.','We tested few people with unusual taste. Keeping answers hidden also left some people with too few dislikes to reveal.'],{y:215,gap:130,size:28});
// 30
s=slide('The next decision needs protection that actually works',{source:source.guard+'; apps/dossier-cli/benchmarks/tmdb-study-v1-reference.json',notes:'Next candidate must address the mechanism of sparse-negative exception detection rather than tune frozen thresholds after outcomes. Use previous cohorts as regression references and genuinely untouched evidence for independent confirmation. Compare against both mandatory public reviews and unchanged current model. Require protections across original five failures and eight unusual cases. Tiny threshold fluctuations are decision aids, not automatic releases.'});
paragraphs(s,['The 75/25 candidate stays fixed. Product defaults stay unchanged.','The next rule must recognise useful personal taste even when the person gives few dislikes.','Every proposed change must retain unusual-taste wins and address all five known learning failures.'],{y:214,gap:122,size:30});
conclusion(s,'Public reviews and current Dossier remain mandatory comparisons. New evidence must confirm the result.',602);
// 31
s=slide('Appendix: every simple comparison',{sub:'After 20 ratings. Scores belong to different tests and should not be compared across columns.',source:source.hard+'; '+source.real+'; '+source.tmdb,notes:'Synthetic labels: popularity, genre,vector,nearest,random. Real public rating is averagepublicfilmrating, popularity is attention, community is otherMovieLens viewer mean excluding target. The latter has extra communitydata and is not a fair app-default baseline. Percentages are ranking AUC; all neutralpersonalratings excluded.'});
const baselineRows=[['Method','Hard invented test','Real bundled test','TMDB test']];
for(const[name,hkey,rkey]of [['Current Dossier','dossier','dossier'],['Public reviews',null,'public_rating'],['Popularity','popularity','popularity'],['Preferred genres','genre','genre'],['Average film style','vector','vector'],['Similar rated films','nearest','nearest'],['Random order','random','random'],['Other viewers’ ratings',null,'community']])baselineRows.push([name,hkey?pct(hard.learning[20][hkey].auc.mean):'Not tested',pct(real.learning[20][rkey].auc.mean),pct(tmdb.learning[20][rkey].auc.mean)]);
table(s,baselineRows,{y:225,h:400,widths:[430,238,234,234],font:22});
text(s,'Other viewers’ ratings use information Dossier does not have.',72,640,1100,38,22,muted);
// 32
s=slide('Appendix: all model comparisons',{sub:'Fixed TMDB comparison test, 31 viewers after 20 ratings',source:source.study});
const compLabels={current:'Current Dossier',no_claims:'Remove inferred claims',no_groups:'Keep each rated film separate',no_groups_no_claims:'Separate films and remove claims',no_dislike_penalty:'Remove the style penalty for dislikes',no_negative_signals:'Use positive ratings and claims only',quality_priority:'Give public reviews much more weight',public_quality:'Public reviews alone',quality_plus_similarity:'75% reviews plus Dossier-style matching',metadata_similarity:'Genre and keyword matching alone',quality_plus_metadata:'75% reviews plus genre/keyword matching'};
const componentRows=Object.entries(compLabels).map(([k,label])=>[label,pct(tmdb.components[20][k].auc.mean),likes(tmdb.components[20][k].precision10.mean)]);
table(s,[['Method','Ordering score','Liked per ten'],...componentRows.slice(0,6)],{y:225,h:350,widths:[690,220,226],font:25});
s=slide('Appendix: alternatives using public reviews',{sub:'Same fixed TMDB comparison test, after 20 ratings',source:source.study});
table(s,[['Method','Ordering score','Liked per ten'],...componentRows.slice(6)],{y:225,h:350,widths:[690,220,226],font:25,highlight:[5]});
// 33
s=slide('Appendix: the eight unusual-taste cases',{sub:'Previous 47-viewer check, after 40 ratings. Same viewers remain explicit in the latest experiment.',source:source.conf+'; '+source.guard,notes:'These eight come from training public AUC <=.60. Every guard decision remains candidate, zero switchesat40. Values match currentmodel/candidate scores in replay. Twenty-rating figures are in main slide21 and original report. Person-labeled output IDs are anonymous MovieLensIDs, not named productusers.'});
table(s,[['Viewer','Public reviews','Fixed candidate','Current Dossier','With protection rule'],...guard.viewers.filter(v=>v.explicitRisk).map(v=>['Viewer '+v.id.split('-').at(-1),pct(v.after[40].publicReviews.auc),pct(v.after[40].candidate.auc),pct(v.after[40].dossier.auc),pct(v.after[40].guard.auc)])],{y:225,h:410,widths:[195,216,228,243,254],font:22});
// 34
s=slide('Appendix: the result of each experiment',{source:Object.values(source).join('; ')});
table(s,[['Experiment','Result and meaning'],['Easy synthetic lab','High scores showed a working pipeline, but overstated learning'],['Hard invented tastes','Dossier learned, but simple matching competed closely'],['Real ratings and film information','Public reviews stayed far ahead on average'],['Claim correction','26 of 28 wrong real claims corrected, without a ranking guarantee'],['Questions and damaged evidence','Questions did not help faster. Bad evidence usually hurt'],['Fixed candidate on 47 new viewers','Small average gain repeated, with serious personal exceptions'],['Five exact failure reproductions','Broad similarities and rating order explained the losses'],['Protection rule on 30 new viewers','Missed the people needing personal rankings. Defaults unchanged']],{y:213,h:438,widths:[420,716],font:23});
// 35
s=slide('Sources and the reports behind the numbers',{source:'reports/*.json and HTML files listed on this slide. https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html; https://www.themoviedb.org/; apps/dossier-cli/benchmarks/MOVIELENS-README.txt',notes:'MovieLens ratings from GroupLens Research, University of Minnesota, 2018 ml-latest-small archive. TMDB data and attribution fromthefrozenfixture. Neither GroupLens nor TMDB endorses this project. MovieLens usage conditions, including commercial permission requirements, remain in the original README and standalone reports. Full sources and file hashes accompany the authored presentation. Earlier CLI and easy-lab records in /tmp are summarized in the saved evidence ledger.'});
paragraphs(s,['Harder invented tests: dossier-hard-v1-baseline.html','Real ratings: dossier-real-v1-baseline.html','Film details and model comparisons: dossier-learning-study.html','New-viewer check: reviews-plus-tags-decision.html','Latest protection test: observed-rating-override-v1.html'],{y:206,gap:64,size:24});
text(s,'Reports live in the repository’s reports folder.\nPersonal ratings: GroupLens / MovieLens. Public film details: TMDB.',72,548,1100,75,24,muted);
text(s,'This product uses the TMDB API but is not endorsed or certified by TMDB.',72,637,1070,36,21,muted);
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'apps/dossier-cli/benchmarks/tmdb-logo.svg'))),contentType:'image/svg+xml',alt:'TMDB logo',fit:'contain',position:{left:1080,top:570,width:110,height:60}});
// Editable content and source ledger remain separate from temporary validation artifacts.
await fs.writeFile(path.join(workspaceDir,'deck-content.json'),JSON.stringify(ledger,null,2)+'\n');
await fs.writeFile(path.join(workspaceDir,'evidence-summary.json'),JSON.stringify({easy:{people:easy.syntheticUsers,curated:easy.curatedUsers,metrics:easy.metrics},live,hard:{legacy:hard.legacyInvestigation,learning:hard.learning,beliefCorrectionRate:hard.beliefCorrectionRate,beliefOutcomes:hard.belief.map(x=>({person:x.person,outcome:x.outcome})),damage:hard.damage.summary},real:{learning:real.learning,beliefCorrectionRate:real.beliefCorrectionRate,calibration:real.calibration.byCount,damage:real.damage.summary},tmdb:{learning:tmdb.learning,components20:tmdb.components[20],calibration:tmdb.calibration.byCount,damage:tmdb.damage.summary,backwardsSessions:35},confirmation:{overall:conf.overall,highRisk:conf.highRisk},diagnosis:diagnosis.cases.map(c=>({viewer:c.viewer,seed:c.seed,auc10:c.auc10,auc40:c.auc40,orderSensitivity:c.orderSensitivity})),override:{checks:guard.checks,cohorts:guard.cohorts,detection:guard.detection,failures:guard.failures,verification:guard.verification}},null,2)+'\n');
await fs.writeFile(path.join(build,'deck-prose.md'),ledger.map(x=>'## '+x.title+'\n\n'+x.notes).join('\n\n'));
const candidatePath=path.join(build,'candidate-v3.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const FINAL_PPTX=path.join(workspaceDir,'output/dossier-experiments-overview-v3.pptx');
const result=await finalizePresentation({workspaceDir,candidatePath,finalPath:FINAL_PPTX,pythonExecutable:RUNTIME_PYTHON,integrityValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tableOwners.flatMap(n=>['--require-native-table-slide',String(n)])],requiredNativeTableOwnerSlides:tableOwners,requiredNativeChartOwnerSlides:chartOwners,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[body,heading]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation-v3.json')});
console.log(JSON.stringify({slides:p.slides.items.length,result}));
