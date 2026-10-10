import type { TasteClaim } from './store/model.js';

/** Display the lens direction correctly, including claims saved by older builds. */
export function tasteClaimsForDisplay(claims: readonly TasteClaim[]): TasteClaim[] {
  return claims.map(claim => ({ ...claim, conditions: claim.conditions.map(condition =>
    condition.kind === 'feature_axis' && condition.value === 'realism' ? { ...condition,
      label: condition.side === 'high' ? 'fantastical settings' : 'realistic settings' } : condition) as TasteClaim['conditions'] }));
}
