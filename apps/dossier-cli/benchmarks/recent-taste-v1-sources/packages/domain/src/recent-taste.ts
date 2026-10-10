import { learnTasteDistinctions, learnedTasteEvidence } from './learned-taste.js';
import { scoreBalancedTaste } from './balanced-taste.js';
import { DEFAULT_SCORING_PARAMS, type ScoringParams } from './recommender.js';
import { ratingWeight, type PairwiseChoice, type RatingEntry, type TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const RECENT_TASTE_CONFIG = { window: 12, maximumAgeDays: 14, minimumHistoryDays: 30, minimumDistinctDays: 4,
  validationSize: 6, minimumImprovement: .2, maximumInfluence: .25 } as const;
const DAY = 86400000;

export function recentTasteEvidence(entries: readonly RatingEntry[], choices: readonly PairwiseChoice[], now = Date.now()) {
  const watched = entries.filter(e => Math.abs(e.rating) >= 1 && e.ts <= now).slice().sort((a,b) => a.ts - b.ts || a.item.key.localeCompare(b.item.key));
  const recent = watched.slice(-RECENT_TASTE_CONFIG.window);
  const none = { influence: 0, validationImprovement: 0, recent, taste: null as ReturnType<typeof learnTasteDistinctions> | null };
  if (recent.length < RECENT_TASTE_CONFIG.window || watched.length < 24 ||
      now - recent.at(-1)!.ts > RECENT_TASTE_CONFIG.maximumAgeDays * DAY ||
      recent.at(-1)!.ts - watched[0]!.ts < RECENT_TASTE_CONFIG.minimumHistoryDays * DAY ||
      new Set(recent.map(e => Math.floor(e.ts / DAY))).size < RECENT_TASTE_CONFIG.minimumDistinctDays) return none;
  const training = recent.slice(0, -RECENT_TASTE_CONFIG.validationSize), validation = recent.slice(-RECENT_TASTE_CONFIG.validationSize);
  if ([training, validation].some(rows => rows.filter(e => e.rating > 0).length < 2 || rows.filter(e => e.rating < 0).length < 2)) return none;
  const excluded = new Set(recent.map(e => e.item.key));
  const enduring = learnTasteDistinctions(entries.filter(e => !excluded.has(e.item.key)), choices, 'comparisons');
  const fresh = learnTasteDistinctions(training, choices, 'comparisons');
  const error = (taste: typeof fresh) => validation.reduce((sum,e) => sum +
    Math.abs(ratingWeight(e.rating)) * (learnedTasteEvidence(e.item, taste).score - ratingWeight(e.rating) / 2) ** 2, 0);
  const oldError = error(enduring), recentError = error(fresh);
  const improvement = (oldError - recentError) / Math.max(.1, oldError);
  if (improvement < RECENT_TASTE_CONFIG.minimumImprovement) return { ...none, validationImprovement: improvement };
  return { influence: RECENT_TASTE_CONFIG.maximumInfluence * Math.min(1, improvement), validationImprovement: improvement,
    recent, taste: learnTasteDistinctions(recent, choices, 'comparisons') };
}

export function scoreRecentTaste(candidates: TmdbItem[], entries: readonly RatingEntry[], claims: readonly TasteClaim[], choices: readonly PairwiseChoice[],
  params: ScoringParams = DEFAULT_SCORING_PARAMS, now = Date.now()) {
  const scored = scoreBalancedTaste(candidates, entries, claims, choices, 'balanced_comparisons', params, now);
  const evidence = recentTasteEvidence(entries, choices, now);
  if (!evidence.taste) return scored;
  const enduring = learnTasteDistinctions(entries, choices, 'comparisons');
  return scored.map(row => ({ ...row, score: row.score + evidence.influence *
    (learnedTasteEvidence(row.item, evidence.taste!).score - learnedTasteEvidence(row.item, enduring).score) }))
    .sort((a,b) => b.score - a.score);
}
