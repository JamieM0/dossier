# Impact correction: executive decision

Retain Dossier's current default model. Scaled broad influence passes the observed safety and correction requirements, but its recommendation gain remains too small.
Drop the tested shared ranking cap from adoption consideration. It adds little benefit and changes unrelated preferences in populated profiles.

Jamie is the only real product user. These conclusions use the synthetic lab without requiring additional real users.

## What the experiment tested

Experiment eight limits broad preferences while retaining exact title and comparison controls.
It compares existing scoped, guarded, and reviewed policies with three new candidates.
Two candidates limit contributions relative to the existing score spread, with and without follow-up review.
The third also limits changed ordering relationships per film.
Approval never removes these limits.

The cohort contains 200 fresh synthetic people, 200 fresh films, and 400 sessions.
The decision uses 100 reserved people with additional preference combinations.
New stress cases include weak ratings and misleading explanations supported by a biased library.
Every policy has the same eight-question budget, including any follow-ups.

Commit `6c4b37b` freezes the policies, cohort, evaluator, and requirements before the reserved replay.
Commit `a40bb9b` fixes shared tuple typing. The emitted scorer remains byte-for-byte identical after that fix.

## Outcomes

Ranking accuracy measures whether liked hidden films rank ahead of disliked films. Chance scores 50 percent.
Gain intervals describe uncertainty across reserved synthetic people after averaging their two sessions.

| Policy | Reserved accuracy | Gain over current, in points | Largest loss after one answer |
| --- | --- | --- | --- |
| Current | 70.03% | Reference | 0.00 |
| Scoped priority | 74.85% | +4.82; interval +3.58 to +6.12 | 55.28 |
| Evidence guard | 75.55% | +5.52; interval +4.39 to +6.73 | 27.93 |
| Follow-up review | 74.99% | +4.96; interval +3.80 to +6.18 | 55.28 |
| Scaled guard | 71.13% | +1.10; interval +0.86 to +1.36 | 2.48 |
| Scaled review | 71.10% | +1.06; interval +0.82 to +1.32 | 2.64 |
| Shared ranking cap | 70.19% | +0.16; interval +0.11 to +0.20 | 1.03 |

No candidate passes every frozen adoption requirement.
The new limits pass the observed five-point loss requirement. The stronger earlier policies still fail it.
The scaled candidates fail the two-point gain requirement and the requirement to retain 80 percent of accurate-feedback gains.

## What we learned

**Useful control does not require broad priority.** Scaled review passes all 149 general reversal trials and all 200 title and 200 comparison trials.
Scaled guard passes 139 general trials, or 93.29 percent, exceeding the 90-percent requirement.
Both preserve unrelated scores in isolated and populated profiles.
They also pass pending-score, removal, restoration, portability, and declared-limit checks.

**Limits resolve the observed severe-loss problem at a cost.** Scaled guard reduces the largest loss from the unscaled guard's 27.93 points to 2.48.
It also reduces mean gain from 5.52 points to 1.10.
For accurate multiple preferences, scaled gain is 1.87 points compared with scoped priority's 7.84.
It retains about 24 percent of that gain, against the required 80 percent.
This is a measured learning tradeoff, rather than a failure to store or obey feedback.

**Repeated approval adds little under the tested limit.** Scaled review gains 1.06 points compared with scaled guard's 1.10.
It improves general control, but it does not establish greater recommendation benefit on this cohort.
Follow-up counts and withdrawal decisions remain visible in the detailed results.

**A shared ranking budget creates collateral effects.** The ranked candidate passes only 132 of 149 general reversal trials, or 88.59 percent.
It also fails the populated-profile scope check.
Changing one preference can shrink the shared budget and attenuate older preferences elsewhere.
Its mean gain is only 0.16 points. The added mechanism does not justify its complexity or failed controls.

**Evidence selection remains a relevant stress case.** The biased-library group includes apparently consistent explanations that do not represent its private preference rules.
Its aggregate gains do not prove that misleading evidence is harmless.
All noisy and biased groups still need their own protection checks, alongside the largest observed answer loss.

## Recommended project decision

Keep ordinary recommendations unchanged under the frozen adoption criteria.
Use `impact_guarded` as the experimental reference for further development.
Retain `impact_reviewed` as the control when deliberate general reversal matters.
Stop developing the tested shared ranking cap as an adoption candidate.

The next useful hypothesis concerns stronger evidence, rather than another repeated confirmation.
Test whether new, independent title ratings can justify greater influence for a broad preference without reopening severe losses.
Compare targeted validation ratings with an equal-budget ordinary-rating baseline on fresh reserved people.
Keep those validation titles separate from the hidden films used to judge recommendation quality.

This experiment does not establish how much extra evidence is sufficient or whether a stronger policy will pass.
Do not raise the strength or relax the failed gain requirements based on this reserved cohort.
Precise title and comparison controls remain separate from broader preference learning.
Jamie can review the experimental behavior without treating that review as additional independent model evidence.

## Implementation and verification

The CLI adds `impact_guarded`, `impact_reviewed`, and `impact_ranked` experimental scoring arms.
Their outputs expose broad contributions, scale, attenuation, changed relationships, review status, and conflicts.
Encrypted export and import preserve scores and state. Ordinary recommendations retain their behavior.

The complete traces preserve ratings, questions, answers, previews, profiles, rankings, and correction trials.
Independent audits reconstruct every path and check the actual raw and published relation limits.
All five reconstruction audits pass.
Two complete runs produce identical traces and decisions apart from runtime.
All 156 unit tests and shared type checks pass. Earlier experiment archives remain unchanged.
The verification record records repeat equality, test outcomes, and protected earlier evidence.
The regression record compares ordinary recommendations with historical outcomes.

These results cover known synthetic film candidates. They do not establish retrieval quality, television performance, human comprehension, or response time.
A relation limit cannot guarantee an accuracy loss bound for every possible hidden-label distribution.
Candidate-pool composition affects the tested limits. Title and comparison trials use rated diagnostic titles.
All hidden-film quality paths receive broad feedback only.

Read the [measured results](impact-correction-v1.md), [lossless traces](impact-correction-v1.json.gz), and [protocol guide](../docs/impact-correction-experiment.md).
Read the [verification record](impact-correction-verification-v1.json) and [regression record](impact-correction-regression-v1.json) for reproduction and protection checks.
