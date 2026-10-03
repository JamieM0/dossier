## Learning a person’s taste



## The findings that matter most

The references use different cohorts and checkpoints. We compare methods within each experiment. We do not infer a trend in model quality from changes between cohorts. Product defaults remain unchanged.

## The product question



## How the experiments work

The runner creates disposable profiles and uses the same CLI action handlers as normal CLI use. The catalogue adapter supplies public film details. Only training ratings enter Dossier. Hidden ratings score the completed output. All later studies use fixed evidence orders and repeatable fixtures.

## What the two main scores mean

Ordering score is ranking AUC. It compares every clear liked/disliked pair, with ties worth half. Neutral ratings do not enter it. An unavailable ranking scores 50%. Clear likes among ten suggestions use the first ten recommendations and score missing recommendations as zero. Neither score is a calibrated prediction of a star rating. Four or more MovieLens stars count as clear likes. At most 2.5 stars count as dislikes.

## What the methods mean



## The sequence of experiments

This is the sequence of test designs. Repeated runs and implementation parity checks support each design but do not count as new independent people.

## The first tests looked unusually strong

The large synthetic run contains 24 designed profiles and 240 variations, with four clone trials per person. Variations share the designed profile rules and are not 264 independent real people. The single-person sensitivity example has 20 hidden films. Ten coherent ratings score 95%, reversing five of those ratings scores 57%. The easy oracle shares feature axes with Dossier. Simple cosine matching scores 99.17% after one rating in the later investigation.

## The CLI really changed the model

We rated ten known films, inspected recommendations, claims, explanations, calibration questions and taste areas, then added a positive Avengers: Infinity War rating. The ten recommended film identities stayed the same, but their scores and order changed. Six remaining negative claims weakened, one disappeared, and the rating queue changed. A clean replay matched before and after. CLI profiles are separate from the GUI library, so this did not establish shared live UI state.

## Harder invented tastes exposed weaknesses

18 fixed people, 288 invented films, 72 hidden films per person, four rating orders. Personas include split tastes, genre exceptions, director loyalty, franchises, broad and selective tastes, unreliable raters, mood-dependent tastes, subtle distinctions and misleading starts. The adapter builds Dossier features from public fields. Some hidden preferences depend on unavailable properties, which intentionally tests representation limits.

## Dossier learned, but simple matching competed

At 20 ratings Dossier AUC 0.7612, nearest baseline 0.7537, genre 0.7165, vector 0.6408, popularity 0.5669, random 0.5334. Precision10 0.4264 and 0.45 for nearest. Dossier improves from 0.5391 at one rating to 0.8045 at forty, averaged across all people and orders. This is not a direct comparison with the later real-film cohorts.

## The same invented person could get different lists

The early clone test varies the evidence supplied to four copies of each synthetic person. Mean pairwise top-ten overlap is 0.633 and mean pairwise hit-rate difference 0.074. This mixes different film evidence and evidence order. It does not isolate order alone. Later diagnostic replay isolates order using identical forty-rating libraries and fixed claims.

## Real films and real recorded ratings

MovieLens 2018 latest-small source. Every viewer with at least 150 matched ratings and forty clear likes and dislikes joins the original cohort. The catalogue contains 1,736 films. Each of the thirty-one viewers has sixty hidden films and four seeded learning orders. Film matches use exact release year and normalized title, excluding ambiguous matches. These are historical anonymous viewers, not thirty-one people recruited to use Dossier today.

## Public reviews beat the current model

The bundled BestSimilar film catalogue has sparse director and collection fields. This is the original real-v1 benchmark, not the later TMDB catalogue. Other MovieLens viewer means score 82.13% and 6.61 likes but use information unavailable to Dossier. The deck keeps that comparison in the appendix.

## Better film information did not close the gap

We freeze viewer identities, rating splits and evidence orders while replacing bundled descriptions with retrieved TMDB genres, keywords, overviews, public reviews, directors and collection information. 1,735 director records and 477 collections. Dossier AUC20 changes 61.13% to 59.24%. Public review ordering changes 82.31% to 80.67%. This controlled result does not establish that one metadata source is generally better. Model parameters did not change. The TMDB study is the frozen regression reference.

## More ratings helped slowly on average

Dossier learning checkpoints 52.98%,54.94%,56.53%,57.6%,59.24%,60.18%. Public reviews 80.67%, unchanged by evidence count. More evidence improves the mean, but thirty-five of 124 sessions lose more than three AUC points between ten and forty ratings, across twenty-four viewers. Sparse profiles can return no recommendations. Ordering AUC then uses chance at 50%, while first-ten likes count missing output as zero.

## Claims often corrected, but rankings still failed

Hard synthetic belief tests: three correctly removed, two overcorrected, five total. TMDB real tests: 25 correctly removed, one correctly replaced, two overcorrected, three no false claim formed. Eligible denominator twenty-eight, so 26/28=92.86%. Tests deliberately construct biased evidence, then add matching contradictory training ratings. No claim-correction percentage is a measure of all inferred claims or all user preferences. Narrowing may happen through other claims but primary classifications are removal/replacement here.

## Dossier’s questions did not teach it faster

Calibration arms share five initial ratings and later rate either Dossier-chosen unseen training titles or randomly selected titles from the more popular 75% of the unseen pool. Both arms score the same sixty hidden films. At 40, active AUC .5806 and reasonable random .6189. Viewer-bootstrap difference -.0383, 95% interval -.0769 to -.0005. At 20 interval crosses zero. Hard synthetic at 20 +0.0071 but at40 -.0122. Bundled real at40 -.0111. We always reveal the recorded rating; recognition and willingness to answer are not tested.

## Damaged ratings usually damaged the result

TMDB damage summary means: half reversed -.0690, randomized -.1101, important removed -.0471, contradictions -.0338, twenty reduced to five -.0307. All aggregate sensitivity flags pass the predefined threshold, but many individual results remain unchanged or improve. Bundled real contradiction and five-rating conditions fall below the three-point sensitivity threshold. Hard invented cohort degradation is larger: -25.55,-32.74,-22.14,-25.22,-20.54 points. Damage trials score current Dossier, not the fixed 75/25 candidate.

## Public reviews drove the strongest alternatives

TMDB model component comparisons: current .5924, no claims .5913, no groups .5895, no groups/no claims .5834, no dislike penalty .5714, no negative signals .5699, increased quality .7498, public .8067, reviews plus lens similarity .7907, tags alone .5780, reviews plus tags .8126. Eleven methods are exploratory, selected on the same data. The .0059 average candidate gain does not independently confirm improvement. Removing claims, groups, or negatives globally does not solve the average gap and may harm useful individual effects.

## A small benefit repeated on 47 new viewers

47 previously unused viewers from the same MovieLens archive and same 1,736-film TMDB catalogue. Sixty fixed hidden films each, four orders. Public AUC .7288 and precision .6532; candidate .7383/.6777; Dossier .6007/.5133. Paired candidate-public mean AUC gain .0095 (reported rounded), interval .0033 to .0160. Top-ten precision gain .0245, interval .0085 to .0415. One viewer loses over three AUC points vs public, six gain. No average individual loss reaches one like/ten vs public. This is confirmation on new individuals, not an independent population.

## The average benefit hides people who lose

Viewer82 current AUC .8301, candidate .5559, public .4835. Viewer484 current .6903, candidate .5225, public .5023. Eight unusual-taste viewers are defined using public-review ordering <=.6 on the full training pool, never hidden labels. Candidate-public group gain .0103, 95% interval -.009 to .0313. Four individuals lose over three points against current Dossier in the full confirmation cohort. First-ten counts and full ordering can disagree: viewer484 candidate has .75 more likes per ten despite worse overall ordering.

## The five worst learning declines reproduced

Five largest frozen 10-to40 declines selected before new-viewer scoring. Exact replay through actual CLI after every rating and additive score reconstruction. Viewer21 seed83 .6721-.3766;177/11 .7937-.5547;483/83 .5114-.2828;21/11 .6867-.4627;603/29 .7041-.4898. Four distinct people, five evidence orders. Do not describe them as five independent users.

## New evidence can spread to the wrong films

Exact score decomposition and all eight before/after component combinations establish mechanisms in these frozen cases. Viewer483/83 like Fellowship count12 changes groups and helps disliked FantasticFour over liked Adaptation. Omitting newly formed liked groups recovers much of the single-step loss. Viewer21/11 dislike TwoTowers count26 creates a disliked group and puts ItTakesTwo before liked TotalRecall. Holding prior dislike contribution nearly restores that step. These diagnostic interventions use earlier snapshots and hidden outcomes to explain failure, not to choose deployed recommendations.

## Rating order changes the final model too

Twelve shuffled input orders of the same final forty ratings, with the final claim set held fixed. This isolates order sensitivity in buildTasteSpace grouping. Viewer603 min .4469,max .5755 is 12.86 points. Other cases range 7.15,7.82,7.71,5.35 points approximately. It does not include claim-update order effects because those are held fixed.

## The proposed protection rule

Fixed before hidden outcome scoring: unchanged candidate by default, current Dossier only after >=20 supplied ratings, >=6 likes, >=6 dislikes, supplied public AUC <=.6. Three stratified folds repeated at seeds101,211,307. Current must beat candidate and public by >=.05 in every repeat and both 95% title-bootstrap lower bounds >0. Hidden answers and viewer IDs do not enter decision. Thirty untouched viewers with forty hidden films, previous78 viewers included. Models unchanged.

## The protection rule missed the people it needed

Primary checkpoint40. Zero of120 fresh sessions selected. Nineteen current-model opportunities >.03 AUC in nine fresh viewers missed. Eighty-six sessions blocked by balanced evidence minimum, twenty-six by public-agreement condition, eight by unreliable repeated validation. Sixteen new viewers have fewer than six clear dislikes/likes in their full training pool because holdout reserves dislikes. These cohort/split limitations qualify sensitivity. Across all432 sessions one confirmation viewer292/order11 switches at40 and gains4.33 points vs candidate. Viewer82 four dislikes,484two or three after40.

## The fixed alternative avoided large losses

All five exact current-model failures reproduce unchanged. The guard falls back to unchanged candidate throughout those failures. At forty candidate gains13.06 to47.98 points over current. Four cases meet all predefined checks. Viewer483/83 guard10 .7955,guard40 .7626 declines3.29 points, just over three-point limit. Largest individual step loss acrossfive1.95 points, below five-point threshold. This is no evidence the internal Dossier mechanism changed. Recommendation defaults unchanged because exception detection fails regardless of this near-boundary decline.

## What the results mean for someone using Dossier

These are implications drawn from objective retrospective results, not a claim of observed product-user outcomes. Average public-review superiority does not negate individual current-model wins. Mechanism diagnosis and failed detection imply defaults should remain unchanged pending protection.

## What these experiments cannot tell us

Cohorts are selected historical MovieLens users who rated available matched catalogue films. Metadata/public scores postdate personal ratings. Repeated evidence orders are not independent users. Hidden film splits include class-balanced selections. We measure ordering among rated films, not full catalogue retrieval, question recognition, actual product engagement, future taste, mood, or complete explainability. Later cohorts have different eligibility and hidden counts; scores are comparable acrossmethods within each study, not trend claims acrosscohorts.

## The next decision needs protection that actually works

Next candidate must address the mechanism of sparse-negative exception detection rather than tune frozen thresholds after outcomes. Use previous cohorts as regression references and genuinely untouched evidence for independent confirmation. Compare against both mandatory public reviews and unchanged current model. Require protections across original five failures and eight unusual cases. Tiny threshold fluctuations are decision aids, not automatic releases.

## Appendix: every simple comparison

Synthetic labels: popularity, genre,vector,nearest,random. Real public rating is averagepublicfilmrating, popularity is attention, community is otherMovieLens viewer mean excluding target. The latter has extra communitydata and is not a fair app-default baseline. Percentages are ranking AUC; all neutralpersonalratings excluded.

## Appendix: all model comparisons



## Appendix: alternatives using public reviews



## Appendix: the eight unusual-taste cases

These eight come from training public AUC <=.60. Every guard decision remains candidate, zero switchesat40. Values match currentmodel/candidate scores in replay. Twenty-rating figures are in main slide21 and original report. Person-labeled output IDs are anonymous MovieLensIDs, not named productusers.

## Appendix: the result of each experiment



## Sources and the reports behind the numbers

MovieLens ratings from GroupLens Research, University of Minnesota, 2018 ml-latest-small archive. TMDB data and attribution fromthefrozenfixture. Neither GroupLens nor TMDB endorses this project. MovieLens usage conditions, including commercial permission requirements, remain in the original README and standalone reports. Full sources and file hashes accompany the authored presentation. Earlier CLI and easy-lab records in /tmp are summarized in the saved evidence ledger.