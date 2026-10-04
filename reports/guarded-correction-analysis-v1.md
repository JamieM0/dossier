# Guarded correction: executive decision

Keep Dossier's current recommendation model. Evidence-based deferral is the strongest tested direction, but it still fails the frozen adoption requirements.
Follow-up approval restores precise control while reopening large ranking losses. A repeated explanation does not establish that the explanation is useful.

Jamie is the only real product user. These conclusions use the synthetic lab and do not require additional real users.

## What the experiment tested

Experiment seven compares the current scorer, small contributions, scoped priority, evidence-based deferral, and follow-up review.
The lab uses 160 fresh synthetic people, a fresh film catalogue, and 320 sessions.
The decision uses 80 reserved people, including preference combinations absent from development.

Evidence-based deferral pauses a broad preference when matching ratings are insufficient or conflict with it.
Follow-up review asks whether to apply, withdraw, or defer that paused preference.
The simulation includes people who repeat a misleading explanation and people whose honest preferences conflict with ratings.
Follow-ups consume the same eight-question budget as broad questions.

The implementation, inputs, and requirements freeze in commit `79e069d`, before the complete reserved replay.
Neither candidate changes ordinary recommendations. Exact title and comparison controls retain the previous scoped implementation.

## Outcomes

Ranking accuracy measures whether liked hidden films rank ahead of disliked films. Chance scores 50 percent.
Gain intervals describe uncertainty across reserved synthetic people after averaging their two sessions.

| Policy | Reserved accuracy | Gain over current, in points | Largest loss after one answer |
| --- | --- | --- | --- |
| Current | 68.50% | Reference | 0.00 |
| Small contributions | 71.41% | +2.90; interval +1.04 to +4.61 | 46.80 |
| Scoped priority | 71.43% | +2.93; interval +0.61 to +5.07 | 61.54 |
| Evidence-based deferral | 73.58% | +5.08; interval +3.68 to +6.58 | 17.84 |
| Follow-up review | 72.57% | +4.07; interval +2.13 to +5.86 | 70.09 |

Every candidate passes the mean-gain requirement on this cohort. Every candidate fails the requirement that one answer loses no more than five points.
This cohort differs from experiment six. Its gains cannot establish that either earlier policy improved between experiments.

## What this means for Dossier

**Evidence-based deferral earns further development.** It improves both independent and persistent misleading-explanation groups, including their lower uncertainty bounds.
It retains almost all the accurate multiple-preference gain: 11.65 points compared with scoped priority's 11.81.
It also preserves the worst-performing tenth and limits the largest observed loss substantially.

**Strong supporting evidence still permits a harmful generalization.** The worst deferred-policy loss follows a misleading claim about tone.
Seven matching ratings support that claim, and no matching ratings contradict it.
The evidence guard therefore accepts it, but hidden-film accuracy drops 17.84 points.
Consistent examples do not establish that the stated explanation transfers to other films.

**A follow-up answer cannot serve as an unrestricted override.** Review passes all correction trials but fails protection for both misleading-explanation groups.
Its worst loss follows approval of a genre preference despite conflicting ratings.
That approval drops ranking accuracy by 70.09 points.
The mechanism needs a limit on broad influence even after approval.

**Caution can suppress legitimate change.** Deferral improves changing-taste accuracy by only 0.13 points, compared with review's 3.62.
Older ratings can conflict with an honest new preference.
A future policy must distinguish those cases without assuming that every repeated explanation deserves priority.

**Precise controls remain reliable.** Both new policies pass all 160 title and 160 comparison reversal trials in reserved sessions.
They preserve unrelated scores, removal, restoration, pending scores, and encrypted portability.
Deferral passes 104 of 116 general reversal trials, or 89.66 percent. The frozen requirement is 90 percent.
Review passes all 116 general trials when the simulated person deliberately approves both effects.
These trials establish control, rather than the truth of the supplied preference.

## Recommended next decision

Retain the current product baseline and keep both candidates experimental.
Use evidence-based deferral as the starting point for a new hypothesis.
Limit how far one broad preference can move recommendations, including preferences with strong support or repeated approval.
Keep exact title exceptions and direct comparisons separate from that limit.

The next experiment should compare that combination against deferral and scoped priority on fresh reserved people.
Include consistent-but-misleading evidence, persistent wrong explanations, and honest changes of taste.
Test whether gradual broad influence preserves the observed gains while meeting the existing five-point loss limit and correction requirements.
Do not relax the failed requirements or reuse this reserved cohort as fresh confirmation after tuning.

The experiment supports this direction for investigation. It does not establish a safe strength or prove that an impact limit will pass.
Preview comprehension remains a usability question for Jamie, separate from the model decision.

## Completed work and verification

The CLI now previews supporting ratings, counterexamples, and reasons for review.
It stores apply, withdraw, and defer decisions against exact proposal and rating signatures.
Changed proposals or ratings invalidate approvals. Reset and removal clear associated review state.
Ordinary recommendations retain their behavior.

The full replay preserves questions, supplied answers, previews, profiles, rankings, losses, and control trials.
All five independent audits pass, reconstructing every branch and decision from supplied evidence.
Both complete runs produce identical traces and outcomes apart from runtime.
The verification record records repeated-run equality, test outcomes, and archived evidence checks.
Historical regression outcomes remain identical. All 151 unit tests pass, and type checks report no errors or warnings.

This task adds experimental CLI and domain behavior. It does not measure retrieval, television, human comprehension, or response time.
Title and comparison controls operate on rated diagnostic films; hidden-film gains come from broad preferences.

Read the [measured results](guarded-correction-v1.md), [lossless traces](guarded-correction-v1.json.gz), and [protocol guide](../docs/guarded-correction-experiment.md).
Read the [verification record](guarded-correction-verification-v1.json) and [regression record](guarded-correction-regression-v1.json) for reproduction and protection checks.
