import { scoreCorrections, validateCorrection, type Correction, type CorrectionState } from './effective-correction.js';
import { matchesLensRule } from './personal-lens.js';
import type { RatingEntry, TasteClaim } from './store/model.js';
import type { TmdbItem } from './tmdb/types.js';

export const PROTECTED_ARMS = ['guarded', 'reviewed'] as const;
export type ProtectedArm = typeof PROTECTED_ARMS[number];
export const PROTECTION_CONFIG = { minimumExamples: 4, maximumCounterexampleShare: .25 } as const;
export type ReviewDecision = 'apply' | 'withdraw' | 'defer';
export type CorrectionReviews = { version: 1; reviews: { id: string; signature: string; decision: ReviewDecision }[] };
export const emptyCorrectionReviews = (): CorrectionReviews => ({ version: 1, reviews: [] });
export function readCorrectionReviews(value: unknown): CorrectionReviews {
  if (value === undefined) return emptyCorrectionReviews();
  const state = value as CorrectionReviews;
  if (!state || state.version !== 1 || !Array.isArray(state.reviews) || state.reviews.length > 50) throw new Error('Invalid correction reviews');
  for (const r of state.reviews) {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 500 || typeof r.signature !== 'string' || r.signature.length > 100000 || !['apply','withdraw','defer'].includes(r.decision)) throw new Error('Invalid correction review');
  }
  if (new Set(state.reviews.map(r => r.id)).size !== state.reviews.length) throw new Error('Duplicate correction review');
  return { version: 1, reviews: state.reviews.map(r => ({ id:r.id, signature:r.signature, decision:r.decision })) };
}
export function correctionPreview(value: Correction, entries: RatingEntry[]) {
  const feedback = validateCorrection(value);
  if (feedback.kind !== 'general') throw new Error('Preview requires a general preference');
  const matching = entries.filter(e => matchesLensRule(e.item, feedback.conditions)).sort((a,b) => a.item.key.localeCompare(b.item.key));
  const supporting = matching.filter(e => e.rating * feedback.effect > 0).map(e => e.item.key);
  const counterexamples = matching.filter(e => e.rating * feedback.effect < 0).map(e => e.item.key);
  const examples = supporting.length + counterexamples.length;
  const reasons = [] as string[];
  if (examples < PROTECTION_CONFIG.minimumExamples) reasons.push('insufficient_evidence');
  if (examples > 0 && counterexamples.length / examples >= PROTECTION_CONFIG.maximumCounterexampleShare) reasons.push('conflicting_ratings');
  // Bind review to the exact proposal and rating evidence, without a platform-specific hash API.
  const signature = JSON.stringify({ feedback, evidence:matching.map(e => [e.item.key, e.rating, e.ts]) });
  return { id:feedback.id, signature, supporting, counterexamples, reasons, needsReview:reasons.length > 0, confidence:null };
}
export function reviewCorrection(state: CorrectionReviews, feedback: Correction, entries: RatingEntry[], decision: unknown, signature: unknown): CorrectionReviews {
  if (!['apply','withdraw','defer'].includes(String(decision))) throw new Error('Use apply, withdraw, or defer');
  const preview = correctionPreview(feedback, entries);
  if (signature !== preview.signature) throw new Error('Preview changed; inspect the proposal again');
  return readCorrectionReviews({ version:1, reviews:state.reviews.filter(r => r.id !== feedback.id).concat({ id:feedback.id, signature:preview.signature, decision:decision as ReviewDecision }) });
}
export function protectedFeedback(state: CorrectionState, entries: RatingEntry[], reviews: CorrectionReviews, arm: ProtectedArm) {
  const decisions = state.feedback.filter(f => f.kind === 'general').map(f => {
    const preview = correctionPreview(f, entries);
    const receipt = reviews.reviews.find(r => r.id === f.id && r.signature === preview.signature);
    const status = arm === 'reviewed' && receipt ? receipt.decision : preview.needsReview ? 'defer' : 'apply';
    return { ...preview, status, reviewed:arm === 'reviewed' && Boolean(receipt) };
  });
  const feedback = state.feedback.filter(f => f.kind !== 'general' || decisions.find(d => d.id === f.id)!.status === 'apply');
  return { state:{ version:1 as const, feedback }, decisions };
}
export function scoreProtectedCorrections(candidates: TmdbItem[], entries: RatingEntry[], claims: readonly TasteClaim[], state: CorrectionState, reviews: CorrectionReviews, arm: ProtectedArm) {
  const protectedState = protectedFeedback(state, entries, reviews, arm);
  return scoreCorrections(candidates, entries, claims, protectedState.state, 'scoped').map(r => ({ ...r,
    correctionEvidence:{ ...r.correctionEvidence, reviews:protectedState.decisions.map(d => ({ id:d.id, status:d.status, reasons:d.reasons, reviewed:d.reviewed })) }
  }));
}
