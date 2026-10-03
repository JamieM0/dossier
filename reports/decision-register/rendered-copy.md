Improve Dossier’s
personal model.

Choose a repair to investigate and inspect the saved results. Public reviews and tags are comparisons for improving Dossier’s existing model.

Five severe failures trace mainly to liked- and disliked-film matching. Use those sessions to test repairs inside Dossier.

Public reviews and simple tag matching beat Dossier on average. Find what its personal model misses and repair it.

Its personal model wins for some unusual tastes. An average improvement must retain those strengths.

Where does Dossier need to improve?

Inspect its accuracy gap against public reviews and simple personal matching. These comparisons set a target for repairing the existing model.

Current Dossier · model to improve

Learns from rated films, groups shared features, infers taste statements, and applies likes and dislikes.

Public reviews · comparison

Ranks by the average audience rating. Does not learn the person.

Reviews + tags · comparison

75% public ratings and 25% genres and keywords matched to personal ratings.

Film-order accuracy

Higher = more liked films above disliked films

Liked films per ten

Higher = more suggestions this person likes

Against public reviews

Film-order points · positive is better

Against Reviews + tags

Film-order points · positive is better

22 of 30 viewers lose more than three points against Reviews + tags; 21 lose against public reviews.

First ten: 14 of 30 get at least one fewer liked film than with Reviews + tags; 14 get fewer than with public reviews.

Does more evidence help?

From 10 to 40 ratings: +1.96 film-order points. This result improves or stays level with more evidence.

People whose results get worse

Click a viewer to see their learning curve. Losses use the comparison selected above. Switch the chart measure to find worse ordering or fewer liked films.

Film-order accuracy counts how often a liked hidden film ranks above a disliked one. Higher is better; 50% is chance. “Liked films per ten” counts films rated at least four stars. Higher is better. Hidden ratings never train Dossier.

Latest group: 30 previously unused viewers at the time of the test, four sessions each, 40 hidden films each. They are now a regression group.

Which part of the model should we repair?

Temporarily removing a part helps diagnose its contribution. Compare those tests with changes that keep Dossier’s personal model intact.

31 viewers · 20 ratings · TMDB

Against public reviews: −21.43 film-order points. These exploratory results do not establish a repair on new viewers.

Separate experiment: the same 31 viewers, hidden ratings and rating orders. Removing a part is a diagnostic, not a proven repair. External comparisons stay labelled separately. Untested combinations have no score.

Which film should Dossier ask you to rate?

The point of a rating question is to improve the next recommendations. Dossier’s chosen questions perform worse here.

Dossier’s extra question selection does not improve the average result at this checkpoint.

Accuracy after the same rating effort

Both sessions start with the same five ratings. Then they ask different questions. This uses current Dossier only, with 31 viewers and two sessions per viewer.

At 40 ratings, Dossier’s question strategy is 3.83 points worse. The estimated difference ranges from 0.05 to 7.69 points worse. Viewers may not recognise the films selected; the lab assumes they can rate them.

How do we stop more ratings making Dossier worse?

Replay five severe learning failures. Inspect which part of the personal model causes the loss, then record a repair to test.

Dossier after 10 ratings

Film-order accuracy · higher is better

Dossier after 40 ratings

−29.55 points after more ratings

Diagnostic replay at 40

Current Dossier · not a tested repair

Change versus Dossier at 40

Film-order points · positive helps this replay

Which part explains the loss?

These are saved diagnostic replays, not deployable fixes. Each replay borrows one part of the ten-rating scores and keeps the other parts at 40 ratings.

Identified failure mechanism

One new mistake: disliked “Pride & Prejudice” moves above liked “Jurassic Park III”.

Reordering the same final ratings gives 36.4%–43.5% accuracy, with taste statements fixed. A repair must also reduce this dependence on rating order.

Does correcting a taste statement improve recommendations?

Dossier usually removes the wrong statement. That alone does not prove its recommendations improve.

The green ratings are likes. The orange ratings are dislikes. These are supplied evidence; hidden ratings remain separate.

Likes lighter themes

The original statement is no longer active.

Dislikes character focus · model confidence 73.3%

Likes spy · model confidence 73.3%

Dislikes lighter tone · model confidence 71.4%

Model confidence is not a measured chance of being right.

9 of the original ten suggestions stay in the first ten. The test classifies a loss greater than five film-order points as correcting too far.

This test adds ratings, rather than direct feedback on a taste statement. It selects a wrong initial statement and supplies counterexamples. Of 28 eligible tests, 25 remove it, one replaces it, and two reduce recommendation accuracy too much. Three other viewers form no eligible wrong statement.

Does the benchmark notice bad evidence?

A useful benchmark should get worse when we damage the input. This one does on average, with important exceptions.

Compare damaged inputs to this recorded result.

Film-order accuracy with each input

Separate damaged-input experiment: one evidence order for each of the original 31 viewers. These inputs do not combine with the other method choices. Better results after damage can expose a model that learned the original evidence badly.

Record the next repair.

Record what to change inside Dossier, which failure it addresses, and what evidence would show improvement. Export a portable copy when ready.

Choices and notes saved in this browser. Export to share them.