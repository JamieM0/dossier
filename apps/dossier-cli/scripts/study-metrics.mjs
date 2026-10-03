import { scoreCandidates, DEFAULT_SCORING_PARAMS, buildTasteSpace, matchesTasteClaim } from '@dossier/domain';
import { average, cosine, distribution, key, round, baselineScores } from './hard-metrics.mjs';
import { meanInterval } from './real-metrics.mjs';

export const componentDefinitions = {
  current: 'Dossier as it is now',
  no_claims: 'Same ranking, without inferred claims',
  no_groups: 'Same ranking, keeping each rated film separate',
  no_groups_no_claims: 'Separate rated films, without inferred claims',
  no_dislike_penalty: 'Same ranking, without the style penalty for disliked films; negative claims still apply',
  no_negative_signals: 'Use liked films and positive claims only',
  quality_priority: 'Same ranking, with public review scores given more weight (1 instead of 0.05)',
  public_quality: 'Public review scores only',
  quality_plus_similarity: '75% public review score, 25% nearest rated-film style score',
  metadata_similarity: 'Match genre and keyword tags directly, without Dossier’s style representation',
  quality_plus_metadata: '75% public review score, 25% direct genre and keyword matching'
};

export function componentScores(candidates, entries, claims) {
  const scored = (name, overrides = {}, selectedEntries = entries, selectedClaims = claims) => {
    const rows = scoreCandidates(candidates, selectedEntries, { ...DEFAULT_SCORING_PARAMS, ...overrides }, selectedClaims);
    return { name, scores: Object.fromEntries(rows.map(row => [key(row.item), Math.round(row.score * 1000) / 1000])), available: rows.length > 0 };
  };
  const nearest = baselineScores('nearest', entries.map(row => ({ item: row.item, rating: row.rating })), candidates, 1);
  const tokens = item => new Set([...item.genres.map(tag => `genre:${tag.toLowerCase()}`), ...item.keywords.map(tag => `tag:${tag.toLowerCase()}`)]);
  const rated = entries.map(row => ({ ...row, tokens: tokens(row.item) }));
  const similarity = (a, b) => a.size && b.size ? [...a].filter(tag => b.has(tag)).length / Math.sqrt(a.size * b.size) : 0;
  const metadata = Object.fromEntries(candidates.map(item => {
    const tags = tokens(item);
    const liked = rated.filter(row => row.rating > 0).map(row => similarity(tags, row.tokens));
    const disliked = rated.filter(row => row.rating < 0).map(row => similarity(tags, row.tokens));
    return [key(item), (liked.length ? Math.max(...liked) : 0) - .6 * (disliked.length ? Math.max(...disliked) : 0)];
  }));
  const quality = Object.fromEntries(candidates.map(item => [key(item), (item.voteAverage ?? 0) / 10]));
  const blend = scores => Object.fromEntries(candidates.map(item => [key(item), .75 * quality[key(item)] + .25 * (scores[key(item)] + .6) / 1.6]));
  return [scored('current'), scored('no_claims', {}, entries, []),
    scored('no_groups', { clusterMergeThreshold: 1.01 }), scored('no_groups_no_claims', { clusterMergeThreshold: 1.01 }, entries, []),
    scored('no_dislike_penalty', { dislikePenalty: 0 }),
    scored('no_negative_signals', {}, entries.filter(row => row.rating > 0), claims.filter(claim => claim.effect === 'positive')),
    scored('quality_priority', { qualityWeight: 1 }),
    { name: 'public_quality', scores: quality, available: true },
    { name: 'quality_plus_similarity', scores: blend(nearest), available: true },
    { name: 'metadata_similarity', scores: metadata, available: true },
    { name: 'quality_plus_metadata', scores: blend(metadata), available: true }];
}

export function aggregateComponents(sessions, checkpoints) {
  const ids = [...new Set(sessions.map(row => row.viewer))];
  return Object.fromEntries(checkpoints.map(count => [count, Object.fromEntries(Object.keys(componentDefinitions).map(name => {
    const metrics = sessions.map(row => row.snapshots[count].components[name]);
    const perViewer = ids.map(id => {
      const own = sessions.filter(row => row.viewer === id);
      return { id, auc: round(average(own.map(row => row.snapshots[count].components[name].auc))),
        deltaCurrent: round(average(own.map(row => row.snapshots[count].components[name].auc - row.snapshots[count].dossier.auc))),
        deltaPublic: round(average(own.map(row => row.snapshots[count].components[name].auc - row.snapshots[count].components.public_quality.auc))) };
    });
    return [name, { auc: distribution(metrics.map(row => row.auc)), precision10: distribution(metrics.map(row => row.precision10)),
      similarPublicRatingAuc: distribution(metrics.filter(row => row.similarPublicRatingAuc != null).map(row => row.similarPublicRatingAuc)),
      coverage: distribution(metrics.map(row => row.coverage)), deltaCurrent: meanInterval(perViewer.map(row => row.deltaCurrent)),
      deltaPublic: meanInterval(perViewer.map(row => row.deltaPublic)), improvedViewers: perViewer.filter(row => row.deltaCurrent > .03).length,
      regressedViewers: perViewer.filter(row => row.deltaCurrent < -.03).length, perViewer }];
  }))]));
}

export function diagnoseLearning(sessions, viewers, byKey) {
  return sessions.filter(session => session.snapshots[40].dossier.auc < session.snapshots[10].dossier.auc - .03).map(session => {
    const viewer = viewers.find(row => row.id === session.viewer);
    const at10 = session.snapshots[10], at40 = session.snapshots[40];
    const harmfulNewClaims = at40.claims.filter(claim => claim.active && !at10.claims.some(old => old.id === claim.id && old.active)).map(claim => {
      const matched = viewer.holdoutItems.filter(item => matchesTasteClaim(item, claim) && viewer.truth[key(item)] !== 0);
      const wrong = matched.filter(item => claim.effect === 'positive' ? viewer.truth[key(item)] < 0 : viewer.truth[key(item)] > 0);
      return { claim, matched: matched.length, contradictory: wrong.length, examples: wrong.slice(0,4).map(item => ({ title: item.title, stars: viewer.heldOut.get(key(item)).stars })) };
    }).filter(row => row.matched >= 3 && row.contradictory / row.matched >= .5);
    const entries = count => session.observed.slice(0,count).map(row => ({ item: { ...byKey.get(row.filmKey), key: row.filmKey }, rating: row.suppliedRating, ts: 0 }));
    const extra = session.observed.slice(10,40);
    const clashes = extra.flatMap(row => session.observed.slice(0,10).filter(early => early.suppliedRating * row.suppliedRating < 0 && cosine(byKey.get(early.filmKey).features, byKey.get(row.filmKey).features) >= .95).map(early => ({ early: early.title, earlyRating: early.suppliedRating, later: row.title, laterRating: row.suppliedRating, similarity: round(cosine(byKey.get(early.filmKey).features, byKey.get(row.filmKey).features)) })));
    return { viewer: session.viewer, seed: session.seed, delta: round(at40.dossier.auc - at10.dossier.auc),
      auc10: at10.dossier.auc, auc40: at40.dossier.auc,
      withoutClaimsDelta: round(at40.components.no_claims.auc - at10.components.no_claims.auc),
      separateFilmsDelta: round(at40.components.no_groups_no_claims.auc - at10.components.no_groups_no_claims.auc),
      withoutDislikePenaltyDelta: round(at40.components.no_dislike_penalty.auc - at10.components.no_dislike_penalty.auc),
      clusters10: buildTasteSpace(entries(10)).clusters.length, clusters40: buildTasteSpace(entries(40)).clusters.length,
      neutralNewRatings: extra.filter(row => row.suppliedRating === 0).length, harmfulNewClaims, conflictingStylePairs: clashes.length,
      styleExamples: clashes.slice(0,6), originalEvidence: session.observed.slice(0,10), addedEvidence: extra };
  }).sort((a,b) => a.delta - b.delta);
}
