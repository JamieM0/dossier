import { reconcileTasteClaims } from './taste-claims.js';
import type { PersistedState, RatedItem } from './store/model.js';

/** Refresh a snapshot only while the observed rating still exists unchanged. */
export function refreshLibraryRatingItem(state: PersistedState, key: string, item: RatedItem, expectedTs: number): PersistedState {
  if (item.key !== key) throw new Error('Item key does not match rating key');
  if (!Number.isFinite(expectedTs)) throw new Error('Invalid rating timestamp');
  const current = state.ratings[key];
  if (!current || current.ts !== expectedTs) return state;
  const ratings = { ...state.ratings, [key]: { ...current, item } };
  return { ...state, ratings, tasteClaims: reconcileTasteClaims(Object.values(ratings), state.tasteClaims) };
}
