import { reconcileTasteClaims, withTasteClaimFeedback } from "./taste-claims.js";
import { isValidRating, type PairwiseChoice, type PersistedState, type RatedItem, type Rating, type TasteClaim, type TasteClaimProvenance } from "./store/model.js";

export function setLibraryRating(state: PersistedState, key: string, rating: Rating | null, item?: RatedItem, now = Date.now()): PersistedState {
  if (rating !== null && !isValidRating(rating)) throw new Error("Invalid rating");
  if (item && item.key !== key) throw new Error("Item key does not match rating key");
  const ratings = { ...state.ratings };
  if (rating === null) delete ratings[key];
  else if (item) ratings[key] = { rating, item, ts: now };
  else if (ratings[key]) ratings[key] = { ...ratings[key], rating, ts: now };
  else throw new Error("Item snapshot required for a new rating");
  return { ...state, ratings, tasteClaims: reconcileTasteClaims(Object.values(ratings), state.tasteClaims) };
}

export function setLibraryClaimFeedback(state: PersistedState, claim: TasteClaim, provenance: Exclude<TasteClaimProvenance, "inferred">, now = Date.now()): PersistedState {
  return { ...state, tasteClaims: withTasteClaimFeedback(state.tasteClaims, claim, provenance, now) };
}

export function addLibraryPairwise(state: PersistedState, choice: PairwiseChoice): PersistedState {
  return { ...state, pairwise: [...state.pairwise, choice] };
}

export function correctLibraryPairwise(state: PersistedState, choice: PairwiseChoice): PersistedState {
  const samePair = (entry: PairwiseChoice) => [entry.winnerKey, entry.loserKey].sort().join("|") === [choice.winnerKey, choice.loserKey].sort().join("|");
  if (!state.pairwise.some(samePair)) throw new Error("Pairwise choice not found");
  return { ...state, pairwise: [...state.pairwise.filter((entry) => !samePair(entry)), choice] };
}

export function setLibrarySkipped(state: PersistedState, key: string, skipped: boolean): PersistedState {
  return { ...state, skipped: skipped ? [...new Set([...state.skipped, key])] : state.skipped.filter((entry) => entry !== key) };
}

export function resetLibraryPreferences(state: PersistedState): PersistedState {
  return { ...state, ratings: {}, pairwise: [], skipped: [], tasteClaims: [] };
}

export function updateLibrarySettings(state: PersistedState, next: Record<string, unknown>): PersistedState {
  return { ...state, settings: { ...state.settings, ...next } };
}
