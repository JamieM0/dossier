import { cosineSimilarity, ratingWeight, matchesTasteClaim, tasteClaimScoreAdjustment, LOCAL_EVIDENCE_CONFIG } from '@dossier/domain';

export const CORROBORATION_CONFIG = { ...LOCAL_EVIDENCE_CONFIG, duplicateCosine: .95 };
export const CORROBORATION_ARMS = ['current', 'local', 'local_recent', 'supported_local', 'supported_recent', 'supported_claims_local', 'supported_claims_recent'];

// Only public item vectors and observed library entries enter this scorer.
export function createCorroborationScorer() {
  const similarities = new Map();
  const proximity = (a, b) => {
    const keys = [a.key ?? `${a.medium}:${a.id}`, b.key ?? `${b.medium}:${b.id}`].sort();
    const id = keys.join('|');
    if (!similarities.has(id)) similarities.set(id, Math.max(0, cosineSimilarity(a.features, b.features)));
    return similarities.get(id);
  };
  return function score(candidates, entries, claims, mode, guardClaims, qualityWeight, referenceTime) {
    const ordered = [...entries].sort((a, b) => a.item.key.localeCompare(b.item.key));
    if (!ordered.some(e => ratingWeight(e.rating) > 0)) return { rows: [], claims: [], evidence: [] };
    const weights = ordered.map(e => Math.abs(ratingWeight(e.rating)) * (mode === 'recent'
      ? 2 ** (-Math.max(0, referenceTime - e.ts) / (86_400_000 * CORROBORATION_CONFIG.halfLifeDays)) : 1));
    const density = ordered.map(e => Math.max(1, ordered.filter(other => ratingWeight(e.rating) * ratingWeight(other.rating) > 0 && proximity(e.item, other.item) >= CORROBORATION_CONFIG.duplicateCosine).length));
    const independent = weights.map((w, i) => w / density[i]);
    const evidence = ordered.map((e, i) => {
      let support = 0, counter = 0;
      for (let j = 0; j < ordered.length; j++) {
        if (i === j || !weights[j]) continue;
        const amount = proximity(e.item, ordered[j].item) ** CORROBORATION_CONFIG.power * independent[j];
        if (ratingWeight(e.rating) * ratingWeight(ordered[j].rating) > 0) support += amount;
        else counter += amount;
      }
      return { key: e.item.key, support, counter, gate: support / (CORROBORATION_CONFIG.prior + support + counter), duplicateCount: density[i] };
    });
    const previews = claims.map(claim => {
      if (!claim.active || claim.provenance !== 'inferred') return { id: claim.id, gate: 1, authoritative: claim.provenance !== 'inferred' };
      const supportingItemKeys = [], counterexampleItemKeys = [];
      let support = 0, counter = 0, largest = 0;
      ordered.forEach((entry, i) => {
        if (!weights[i] || !matchesTasteClaim(entry.item, claim)) return;
        const aligned = (ratingWeight(entry.rating) > 0) === (claim.effect === 'positive');
        if (aligned) { support += independent[i]; largest = Math.max(largest, independent[i]); supportingItemKeys.push(entry.item.key); }
        else { counter += independent[i]; counterexampleItemKeys.push(entry.item.key); }
      });
      return { id: claim.id, support, counter, supportingItemKeys, counterexampleItemKeys,
        gate: Math.max(0, support - largest) / (CORROBORATION_CONFIG.prior + support + counter), authoritative: false };
    });
    const effectiveClaims = guardClaims ? claims.map((claim, i) => ({ ...claim, confidence: claim.confidence * previews[i].gate })) : claims;
    const rows = [];
    for (const item of candidates) {
      if (Object.values(item.features).every(v => v === 0)) continue;
      let numerator = 0, denominator = CORROBORATION_CONFIG.prior;
      ordered.forEach((entry, i) => {
        const contribution = proximity(item, entry.item) ** CORROBORATION_CONFIG.power * independent[i] * evidence[i].gate;
        numerator += contribution * Math.sign(ratingWeight(entry.rating)); denominator += contribution;
      });
      const quality = item.voteAverage == null ? 0 : (item.voteAverage / 10 - .5) * 2;
      rows.push({ item, score: numerator / denominator + qualityWeight * quality + tasteClaimScoreAdjustment(item, effectiveClaims) });
    }
    return { rows: rows.sort((a, b) => b.score - a.score), claims: previews, evidence };
  };
}
