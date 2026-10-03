# Dossier experiment review

## Learning a person’s taste

01

What we tested, what we learned,

and what should happen next

Dossier experiment review

2 October 2026

## The findings that matter most

02

Public reviews beat current Dossier on average in the real-viewer tests.

Reviews plus tags adds a small average benefit. Some people still do much better with current Dossier.

We cannot yet reliably identify those people from limited ratings.

The evidence supports further experiments. Product defaults stay unchanged.

## The product question

03

Does Dossier learn what this person likes

from the few ratings they are willing to give?

A useful model should suggest more films that person enjoys.

New ratings should refine mistaken assumptions without damaging the recommendations.

## How the experiments work

04

1. Start with a person whose film ratings we already know.

2. Give Dossier only some of those ratings through the CLI.

3. Ask it to rank films whose personal ratings we kept hidden.

4. Compare the ranking with those hidden answers.

The hidden answers score the result. They do not train Dossier.

## What the two main scores mean

05

Ordering score

Does a film the person likes appear ahead of a film they dislike?

76% means the liked film comes first

in 76 out of 100 comparisons.

50% means chance ordering.

Liked films among ten suggestions

How many of the first ten films

did the person clearly like?

6.5 means about six or seven liked

films per ten suggestions, on average.

Higher is better for both. A 76% ordering score does not mean a 76% chance of enjoyment.

## What the methods mean

06

Method

What it does

Current Dossier

Uses your ratings to learn film styles, groups and claims about your taste

Public reviews

Ranks films by their published average audience rating

Reviews plus tags

Gives public ratings 75% of the score and personal genre/keyword matching 25%

CLI

A command tool that lets the experiment add ratings and inspect Dossier automatically

## The sequence of experiments

07

Experiment

Why we ran it

Invented people and films

Check the pipeline, then expose harder tastes

Real films and recorded viewer ratings

Remove answers built from our own assumptions

Updated film descriptions and model comparisons

Find what drives the real-viewer gap

Fixed reviews-plus-tags method on new viewers

Check whether a small benefit repeats

Known failures and a protection rule

Protect personal tastes without restoring large losses

## The first tests looked unusually strong

08

98%

ordering score after one rating

for the easy sci-fi person

10 of 10

suggestions liked by that person

after ten ratings

The larger run also found 8.86 liked films per ten after 20 ratings.

The answers used many of the same film properties as Dossier. The test was too easy.

## The CLI really changed the model

09

We added ten ratings, inspected the model, then added a contradictory positive rating for Avengers: Infinity War.

The model changed. Its inferred claims fell from 13 to 12, other claims weakened, and film scores changed.

The same ten films remained in the recommendations. Scores moved, but no new film entered the first ten.

A clean repeat matched. A working pipeline still needed a harder quality test.

## Harder invented tastes exposed weaknesses

10

18 people

288 invented films

72 hidden films per person

Likes horror, but avoids gore.

Follows one director across very different films.

Likes two very different kinds of film, with little in between.

These were useful stress tests. They still could not tell us how real viewers behave.

## Dossier learned, but simple matching competed

Harder invented people, after 20 ratings

11

Ranking method

Ordering score

Liked films per ten

Current Dossier

76.1%

4.26

Match similar rated films

75.4%

4.50

Learn preferred genres

71.7%

4.00

Popularity

56.7%

2.39

Dossier improved with more ratings, but its extra complexity did not win on every measure.

## The same invented person could get different lists

12

About 6 of 10 films

remained the same between recommendation lists for copies of the same person.

Different early ratings could lead Dossier toward different versions of someone’s taste.

We needed to check whether those differences persist with real ratings.

## Real films and real recorded ratings

13

31 viewers

1,736 films

60 hidden films per viewer

MovieLens is an archive of film ratings from real people. We used their recorded answers.

Dossier saw only the ratings we revealed.

Each person supplied ratings in four different orders.

The personal answers now came from people, independently of Dossier’s film descriptions.

## Public reviews beat the current model

Real viewers with the original bundled film descriptions, after 20 ratings

14

Ranking method

Ordering score

Liked films per ten

Current Dossier

61.1%

4.63

Public reviews

82.3%

6.52

Popularity

73.6%

6.29

Match similar rated films

57.1%

4.17

Public reviews found almost two more liked films per ten than current Dossier.

## Better film information did not close the gap

TMDB is a public database of film details and audience ratings.

15

After 20 ratings

Bundled descriptions

Updated TMDB details

Current Dossier

61.1%

59.2%

Public reviews

82.3%

80.7%

The same people and hidden ratings remained in the test. We changed the public film information.

Missing film details were not enough to explain the weak recommendations.

## More ratings helped slowly on average

The fixed TMDB comparison test, 31 viewers

16

35 of 124 sessions got worse between 10 and 40 ratings. The average hides those losses.

## Claims often corrected, but rankings still failed

17

26 of 28

wrong early claims corrected after contradictory real ratings

Two cases went too far. Three other viewers never formed a wrong claim in the first place.

Correcting a statement about taste does not guarantee better film recommendations.

## Dossier’s questions did not teach it faster

The fixed TMDB comparison test, after 40 total ratings

18

Who chooses the next film?

Ordering score

Dossier’s rating queue

58.1%

Random choice from reasonably popular films

61.9%

Both started with the same five ratings and used the same hidden films for scoring.

The current question strategy does not earn its complexity in this test.

## Damaged ratings usually damaged the result

Change in ordering score in the fixed TMDB comparison test

19

Damage to supplied evidence

Average change

Reverse half the ratings

−6.9 points

Shuffle ratings between films

−11.0 points

Remove important ratings

−4.7 points

Add contradictory ratings

−3.4 points

Reduce 20 ratings to five

−3.1 points

The test reacts to bad evidence. Some individuals still improve when evidence gets worse.

## Public reviews drove the strongest alternatives

Same 31 viewers and hidden films, after 20 ratings

20

Method

Ordering score

Current Dossier

59.2%

Dossier without inferred claims

59.1%

Dossier with much more weight on reviews

75.0%

Public reviews alone

80.7%

75% reviews and 25% genre/tag matching

81.3%

The 0.6-point gain was small and exploratory. We needed a separate viewer check.

## A small benefit repeated on 47 new viewers

Same fixed 75/25 method, after 20 ratings

21

Method

Ordering score

Liked films per ten

Public reviews

72.9%

6.53

Fixed reviews plus tags

73.8%

6.78

Current Dossier

60.1%

5.13

About one ranking point better than public reviews.

The likely gain is 0.3 to 1.6 points.

About one extra liked film for every 40 suggestions, on average in this test.

## The average benefit hides people who lose

Two viewers from the 47-person check, after 20 ratings

22

A universal switch would throw away useful personalisation for these viewers.

## The five worst learning declines reproduced

Ordering score in current Dossier with more real ratings

23

Viewer and rating order

After 10 ratings

After 40 ratings

Viewer 21 / order 83

67.2%

37.7%

Viewer 177 / order 11

79.4%

55.5%

Viewer 483 / order 83

51.1%

28.3%

Viewer 21 / order 11

68.7%

46.3%

Viewer 603 / order 29

70.4%

49.0%

These are large losses for particular people. The current model can learn backwards.

## New evidence can spread to the wrong films

24

A new like can boost the wrong film

Liking The Fellowship of the Ring

boosts disliked Fantastic Four

ahead of liked Adaptation.

A new dislike can penalise a favourite

Disliking The Two Towers

pushes disliked It Takes Two

ahead of liked Total Recall.

Broad film similarities reach too far. More ratings can strengthen the wrong match.

## Rating order changes the final model too

25

44.7% to 57.6%

One viewer’s ordering score across different orders

of the same 40 ratings.

We held the inferred claims fixed. The film-grouping step still produced different recommendations.

## The proposed protection rule

26

Start with the unchanged 75% reviews / 25% tags ranking.

Temporarily hide some ratings the person already supplied. Test whether current Dossier predicts them better.

Switch only if that advantage repeats. Require at least 20 ratings, six likes, and six dislikes.

We kept this rule unchanged, then tested 30 new viewers and the 78 previous viewers.

## The protection rule missed the people it needed

27

0 of 120

new-viewer sessions chose

a personal override after 40 ratings

19 missed opportunities

Current Dossier would rank the hidden films at least three points better in those sessions.

The six-dislike requirement blocks viewers 82 and 484. It misses the people we need to protect.

## The fixed alternative avoided large losses

28

Known session

Current Dossier, 40 ratings

Fixed alternative, 40 ratings

Viewer 21 / order 11

46.3%

72.7%

Viewer 21 / order 83

37.7%

66.9%

Viewer 177 / order 11

55.5%

85.3%

Viewer 483 / order 83

28.3%

76.3%

Viewer 603 / order 29

49.0%

62.0%

All five avoid the large original losses. One still loses 3.3 points as ratings increase.

## What the results mean for someone using Dossier

29

Most tested viewers would receive better suggestions from a ranking that gives public reviews much more weight.

A person with unusual taste may lose the recommendations that make Dossier feel personal.

Adding more ratings or answering Dossier’s questions does not reliably prevent that loss.

Dossier needs to recognise when personal ratings should outweigh the public consensus.

## What these experiments cannot tell us

30

The real viewers come from one historical ratings source. We have not tested people using Dossier today.

We rank films they already chose to rate. We have not tested every unseen film or the whole discovery experience.

We tested few people with unusual taste. Keeping answers hidden also left some people with too few dislikes to reveal.

## The next decision needs protection that actually works

31

The 75/25 candidate stays fixed. Product defaults stay unchanged.

The next rule must recognise useful personal taste even when the person gives few dislikes.

Every proposed change must retain unusual-taste wins and address all five known learning failures.

Public reviews and current Dossier remain mandatory comparisons. New evidence must confirm the result.

## Appendix: every simple comparison

After 20 ratings. Scores belong to different tests and should not be compared across columns.

32

Method

Hard invented test

Real bundled test

TMDB test

Current Dossier

76.1%

61.1%

59.2%

Public reviews

Not tested

82.3%

80.7%

Popularity

56.7%

73.6%

67.1%

Preferred genres

71.7%

59.4%

59.1%

Average film style

64.1%

57.8%

56.8%

Similar rated films

75.4%

57.1%

56.1%

Random order

53.3%

50.9%

50.9%

Other viewers’ ratings

Not tested

82.1%

82.1%

Other viewers’ ratings use information Dossier does not have.

## Appendix: all model comparisons

Fixed TMDB comparison test, 31 viewers after 20 ratings

33

Method

Ordering score

Liked per ten

Current Dossier

59.2%

4.48

Remove inferred claims

59.1%

4.49

Keep each rated film separate

59.0%

4.36

Separate films and remove claims

58.3%

4.22

Remove the style penalty for dislikes

57.1%

4.20

Use positive ratings and claims only

57.0%

4.16

## Appendix: alternatives using public reviews

Same fixed TMDB comparison test, after 20 ratings

34

Method

Ordering score

Liked per ten

Give public reviews much more weight

75.0%

5.90

Public reviews alone

80.7%

6.42

75% reviews plus Dossier-style matching

79.1%

6.11

Genre and keyword matching alone

57.8%

3.93

75% reviews plus genre/keyword matching

81.3%

6.43

## Appendix: the eight unusual-taste cases

Previous 47-viewer check, after 40 ratings. Same viewers remain explicit in the latest experiment.

35

Viewer

Public reviews

Fixed candidate

Current Dossier

With protection rule

Viewer 41

51.6%

55.8%

50.9%

55.8%

Viewer 82

48.4%

57.5%

86.0%

57.5%

Viewer 89

61.8%

63.5%

73.4%

63.5%

Viewer 198

69.0%

68.0%

51.8%

68.0%

Viewer 365

49.7%

52.8%

58.8%

52.8%

Viewer 462

57.4%

54.4%

45.1%

54.4%

Viewer 484

50.2%

53.5%

69.8%

53.5%

Viewer 534

63.3%

64.2%

55.4%

64.2%

## Appendix: the result of each experiment

36

Experiment

Result and meaning

Easy synthetic lab

High scores showed a working pipeline, but overstated learning

Hard invented tastes

Dossier learned, but simple matching competed closely

Real ratings and film information

Public reviews stayed far ahead on average

Claim correction

26 of 28 wrong real claims corrected, without a ranking guarantee

Questions and damaged evidence

Questions did not help faster. Bad evidence usually hurt

Fixed candidate on 47 new viewers

Small average gain repeated, with serious personal exceptions

Five exact failure reproductions

Broad similarities and rating order explained the losses

Protection rule on 30 new viewers

Missed the people needing personal rankings. Defaults unchanged

## Sources and the reports behind the numbers

37

Harder invented tests: dossier-hard-v1-baseline.html

Real ratings: dossier-real-v1-baseline.html

Film details and model comparisons: dossier-learning-study.html

New-viewer check: reviews-plus-tags-decision.html

Latest protection test: observed-rating-override-v1.html

Reports live in the repository’s reports folder.

Personal ratings: GroupLens / MovieLens. Public film details: TMDB.

This product uses the TMDB API but is not endorsed or certified by TMDB.
