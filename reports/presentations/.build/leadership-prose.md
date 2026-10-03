# Dossier leadership presentation

## Slide 1

01

Learning who

a person is

What Dossier’s experiments tell us

about better recommendations

Leadership review

2 October 2026

## Slide 2

We tested learning against answers kept hidden

The objective: learn from a few ratings, then suggest films that person actually likes.

02

01

Known taste

Start with recorded

film ratings.

02

Limited evidence

Reveal only a few

through the CLI.

03

Film ranking

Ask Dossier to rank

other rated films.

04

Hidden answers

Check that liked films

come before dislikes.

Invented tastes first. Then 31, 47 and 30 real viewers, with four rating orders each.

CLI means the command tool we used to add ratings and inspect the model automatically.

## Slide 3

Real viewers changed the conclusion

Ordering score: how often a liked film comes first. Higher is better. Public reviews use average audience ratings.

03

98%

after one rating

for an easy invented person

The test shared too many

of Dossier’s assumptions.

31 real viewers, after 20 ratings

In the real-viewer test, public reviews found nearly two more liked films per ten.

## Slide 4

More ratings helped slowly and sometimes hurt

Same 31 viewers, updated public film details. Ordering score, higher is better.

04

35 / 124

sessions got worse

from 10 to 40 ratings

Bad evidence hurt the average:

ratings shuffled: −11 points

half reversed: −6.9 points

Adding ratings is not a reliable promise of better recommendations.

## Slide 5

Correcting claims did not guarantee better films

The model can revise statements about taste. Its choice of questions still needs work.

05

26 / 28

wrong claims corrected

After 40 ratings: who asks better questions?

People need better suggestions as well as more accurate statements about their taste.

## Slide 6

Public reviews drove the strongest alternatives

Same 31 viewers, after 20 ratings. Ordering score, higher is better.

06

Tags match genres and keywords to the person’s ratings.

The 75% reviews / 25% tags method gained only 0.6 points. We tested it on new people.

## Slide 7

The small average benefit repeated

47 previously unused viewers. Same unchanged reviews-plus-tags method, after 20 ratings.

07

Liked films per ten suggestions. Higher is better.

1 extra

liked film per

40 suggestions

on average in this test

The benefit is credible enough to keep testing. It is modest for an individual user.

## Slide 8

Some people need a very different ranking

Two viewers from the 47-person check, after 20 ratings. Ordering score, higher is better.

08

Changing everyone to the average winner would lose useful personalisation for these people.

## Slide 9

We found how the worst learning failures happen

Five reproduced sessions. Ordering score fell sharply as the same people gave more ratings.

09

Viewer / rating order

10 ratings

40 ratings

21 / 83

67.2%

37.7%

177 / 11

79.4%

55.5%

483 / 83

51.1%

28.3%

21 / 11

68.7%

46.3%

603 / 29

70.4%

49.0%

Similarity spreads too far

A like for The Fellowship of the Ring boosts disliked Fantastic Four ahead of liked Adaptation.

The same 40 ratings in a different order also changed the result.

More evidence can reinforce a wrong match. Rating order can also change who Dossier thinks you are.

## Slide 10

The protection rule is not ready

30 new viewers, four sessions each. The rule chose when to trust current Dossier over reviews plus tags.

10

0 / 120

new sessions switched

to the personal ranking

19

missed opportunities

where Dossier was better

Next: recognise useful personal taste even when people provide few dislikes.

Keep both comparison methods and all known failure cases in every test.

Keep the 75/25 candidate unchanged. Keep product defaults unchanged.
