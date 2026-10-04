# Effective correction: executive decision

Keep Dossier's current recommendation model. No tested alternative meets the frozen adoption requirements.
The experiment supports separate correction types, but broad preferences need protection against misleading explanations before adoption.

Jamie is the only real product user. This decision uses synthetic lab evidence without requiring additional real users.

## Changes completed

Dossier's taste screen now explains where each claim came from and shows supporting ratings and counterexamples.
It no longer presents internal confidence values as accuracy percentages.
The lab now replaces and clears ratings through the application's existing transition.
A frozen reference preserves the current model, historical experiment evidence, and five severe learning failures.

Experimental CLI actions store, inspect, remove, and score general preferences, title exceptions, and direct comparisons.
These actions preserve encrypted export and import. They leave ordinary recommendations unchanged.
The preparation commit is `669fc82`. Commit `afae388` freezes the experiment implementation and protocol before the complete replay.

## What the experiment tested

The lab compared four policies across 120 synthetic people and 240 sessions.
The adoption decision uses 60 reserved people, including combinations absent from the development group.
Each person supplied ratings and answered questions using accurate, partial, missing, changing, exceptional, or misleading preferences.
All policies received identical evidence and feedback.

Ranking accuracy measures whether liked hidden films rank ahead of disliked films. Chance scores 50 percent.
Intervals describe uncertainty across synthetic people, rather than the probability of a particular recommendation being correct.

| Policy | Reserved ranking accuracy | Gain over current, in points | Decision |
| --- | --- | --- | --- |
| Current | 71.07% | Reference | Retain |
| Existing feedback behavior | 70.84% | -0.24; interval -0.68 to +0.14 | Does not provide reliable correction |
| Small bounded contributions | 72.69% | +1.62; interval -0.74 to +3.90 | Reject for adoption |
| Explicit priority within scope | 72.50% | +1.42; interval -1.41 to +4.06 | Reject for adoption |

Neither experimental policy reached the required two-point gain. Both intervals include deterioration.
Both also failed the requirements for misleading feedback and losses after individual answers.

## What we learned

**Effective control is possible.** Scoped priority passed all 76 general, 120 title, and 120 comparison trials in reserved sessions.
It preserved unrelated scores, removal, restoration, and encrypted portability.
These diagnostic trials test whether the model obeys supplied feedback. They do not establish whether that feedback represents true taste.

**Small contributions do not guarantee safe or effective control.** Bounded feedback passed general-direction trials but passed only 63 title and 52 comparison trials.
One answer reduced ranking accuracy by 41.52 points.
The scoped policy's worst answer reduced accuracy by 78.19 points.
Both losses followed misleading general explanations, rather than export failures or missing recommendations.

**The effect depends on explanation quality.** Accurate multiple preferences improved bounded and scoped accuracy by 9.33 and 10.61 points.
Misleading explanations reduced it by 12.59 and 15.98 points.
This difference explains why the overall gain cannot justify adoption.

**Missing information remains a separate problem.** The missing-factor group stayed near chance under every policy.
Giving existing descriptions more authority cannot recover a preference that those descriptions do not represent.

**Existing feedback does not deliver the promised scope.** Its title trials replace a rating, which can change scores for other titles.
It passed 22 general and 50 title trials, and no comparison trials.
The product should continue describing evidence and influence accurately.

## Recommended next decision

1. Retain the preparation baseline and keep experimental scoring separate from ordinary recommendations.
2. Freeze a new experiment that separates narrow control from broad preference learning.
3. Test isolated title exceptions and comparisons for reliable control, without claiming they improve unseen-film ranking.
4. Test reversible previews and follow-up questions when broad explanations conflict with existing ratings.
5. Compare those protections against both fixed-strength and scoped policies on fresh reserved synthetic people.

Require the next policy to preserve accurate-feedback gains while reducing misleading-feedback losses.
Keep the existing correction, scope, removal, restoration, portability, and ranking protection requirements.
Do not reuse this reserved group as fresh confirmation after tuning.
Jamie can review whether previews and questions make sense in the product; recruitment is not a prerequisite.

## Validation and limits

The historical hard, film-metadata, confirmation, and override replays retain their recorded baseline outcomes.
The original synthetic suite also completes. The archived evidence hashes remain unchanged.
All 58 browser tests pass, including desktop evidence presentation and visual checks.
Independent report audits reconstruct ratings, questions, answers, rankings, control effects, and adoption gates.
The verification record reports the repeated replay comparison and completed checks.

The first complete replay stopped when a native title correction removed the profile's last positive rating.
The evaluator previously assumed that recommendations always existed. A regression test now covers that valid empty result.
The evaluator records missing control scores as failures and empty recommendations as unavailable.
The completed replay uses the same candidates, cohort, and frozen requirements. No aggregate decision preceded that mechanical fix.

This experiment evaluates known candidate films. It does not evaluate retrieval, television, human comprehension, or response time.
Title and comparison controls operate on rated titles in diagnostic pools.
Their value for unseen-film recommendations remains untested.
The proposed previews and follow-up questions remain future hypotheses.

Read the [measured results](effective-correction-v1.md), [lossless traces](effective-correction-v1.json.gz), and [regression results](effective-correction-regression-v1.json).
Read the [protocol guide](../docs/effective-correction-experiment.md) and [verification record](effective-correction-verification-v1.json) for reproduction details.
