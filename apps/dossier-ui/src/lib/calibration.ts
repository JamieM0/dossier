import { AXIS_KEYS, cosineSimilarity, predictPreference, type AxisKey } from "$lib/recommender";
import { ratingKind, ratingWeight, type Rating, type RatingEntry, type TmdbItem } from "$lib/types";

export type EvidenceLevel = "strong" | "some" | "mixed" | "sparse";
export type DecisionReason = {
  kind: "cold_start" | "focus" | "conflict" | "boundary" | "coverage" | "confirmation" | "fallback";
  summary: string;
  evidence: string[];
  focus?: string;
};
export type SelectedQuestion<T> = { item: T; reason: DecisionReason; learningValue: number };

const AXIS_LABELS: Record<AxisKey, [string, string]> = {
  pacing: ["slower pacing", "faster pacing"], tone: ["darker tone", "lighter tone"],
  emotional_intensity: ["restraint", "emotional intensity"], complexity: ["straightforward storytelling", "complexity"],
  scope: ["intimate scope", "broader scope"], realism: ["fantastical elements", "realism"],
  thematic_weight: ["lighter themes", "thematic weight"], character_focus: ["plot focus", "character focus"],
  moral_clarity: ["moral ambiguity", "clear moral stakes"], structure: ["conventional structure", "unusual structure"]
};

function topAxisDifference(a: TmdbItem["features"], b: TmdbItem["features"]): AxisKey {
  return AXIS_KEYS.reduce((best, k) => Math.abs(a[k] - b[k]) > Math.abs(a[best] - b[best]) ? k : best);
}
function axisPhrase(axis: AxisKey, value: number): string { return AXIS_LABELS[axis][value >= 0 ? 1 : 0]; }
function familiarity(item: TmdbItem): number {
  return Math.min(1, Math.log10((item.popularity ?? 0) + 1) / 3) + Math.min(0.25, (item.voteAverage ?? 0) / 40);
}

/** Deterministic active selection. Familiarity remains part of every score;
 * after the baseline, disagreement with nearby liked/disliked evidence and
 * sparse keyword/tag coverage add learning value. Broad genres are only a
 * discovery constraint; the actual question value comes from the more
 * discriminating TMDB keyword evidence whenever it exists. */
export function selectRateQuestion(candidates: TmdbItem[], entries: RatingEntry[], focus?: string): SelectedQuestion<TmdbItem> | null {
  if (!candidates.length) return null;
  if (entries.length < 5) {
    const item = [...candidates].sort((a,b) => familiarity(b)-familiarity(a))[0];
    return { item, learningValue: 0, reason: { kind:"cold_start", summary:`Starting with a widely known ${item.genres[0]?.toLowerCase() ?? "title"} to establish a baseline.`, evidence:["recognisability", "sparse rating history"] } };
  }
  const signalCounts = new Map<string, number>();
  for (const e of entries) for (const signal of (e.item.keywords.length ? e.item.keywords : e.item.genres)) signalCounts.set(signal, (signalCounts.get(signal) ?? 0) + 1);
  const liked = entries.filter(e => ratingWeight(e.rating) > 0);
  const disliked = entries.filter(e => ratingWeight(e.rating) < 0);
  let best: SelectedQuestion<TmdbItem> | null = null;
  for (const item of candidates) {
    const likeSim = Math.max(0, ...liked.map(e => cosineSimilarity(item.features, e.item.features)));
    const dislikeSim = Math.max(0, ...disliked.map(e => cosineSimilarity(item.features, e.item.features)));
    const conflict = likeSim > .45 && dislikeSim > .45 ? Math.min(likeSim, dislikeSim) : 0;
    const signals = item.keywords.length ? item.keywords : item.genres;
    const coverage = signals.length ? 1 / (1 + Math.min(...signals.map(g => signalCounts.get(g) ?? 0))) : 0;
    const focused = focus && (item.genres.includes(focus) || item.keywords.includes(focus)) ? .9 : 0;
    const learningValue = conflict * 1.2 + coverage * .55 + focused + familiarity(item) * .45;
    let reason: DecisionReason;
    if (focused) reason = { kind:"focus", focus, summary:`You chose ${focus.toLowerCase()}. This familiar title tests a different pattern within that area.`, evidence:[focus, "feature variation", "recognisability"] };
    else if (conflict) {
      const nearLike = liked.sort((a,b)=>cosineSimilarity(item.features,b.item.features)-cosineSimilarity(item.features,a.item.features))[0];
      const nearDislike = disliked.sort((a,b)=>cosineSimilarity(item.features,b.item.features)-cosineSimilarity(item.features,a.item.features))[0];
      reason = { kind:"conflict", summary:`This resembles both ${nearLike.item.title}, which drew you in, and ${nearDislike.item.title}, which did not. Your response helps narrow down the difference.`, evidence:[nearLike.item.key, nearDislike.item.key] };
    } else {
      const area = [...signals].sort((a,b)=>(signalCounts.get(a)??0)-(signalCounts.get(b)??0))[0];
      reason = { kind:"coverage", focus:area, summary:`Dossier has little evidence around ${area?.toLowerCase() ?? "this pattern"}. This recognisable title tests that detail without treating its broad genre as one taste.`, evidence:[area ?? "sparse coverage", "recognisability"] };
    }
    if (!best || learningValue > best.learningValue) best = { item, learningValue, reason };
  }
  return best;
}

export type Prediction = { score: number; evidence: EvidenceLevel; expected: "like"|"dislike"|"uncertain" };
export function predictionFor(item: TmdbItem, entries: RatingEntry[]): Prediction {
  const score = predictPreference(item, entries);
  const meaningful = entries.filter(e => Math.abs(ratingWeight(e.rating)) >= 1).length;
  return { score, evidence: meaningful >= 10 ? "strong" : meaningful >= 5 ? "some" : "sparse", expected: score >= 58 ? "like" : score <= 25 ? "dislike" : "uncertain" };
}

export type Surprise = { direction:"positive"|"negative"; summary:string; options:Array<{kind:"axis"|"genre"|"tag"; key:string; label:string}> };
export function detectSurprise(item: TmdbItem, rating: Rating, before: Prediction, entries: RatingEntry[]): Surprise | null {
  if (before.evidence === "sparse") return null;
  const w = ratingWeight(rating);
  const direction = before.score >= 60 && w <= -1 ? "negative" : before.score <= 25 && w >= 1.5 ? "positive" : null;
  if (!direction) return null;
  const nearest = [...entries].filter(e => direction === "negative" ? ratingWeight(e.rating)>0 : ratingWeight(e.rating)<0)
    .sort((a,b)=>cosineSimilarity(item.features,b.item.features)-cosineSimilarity(item.features,a.item.features))[0];
  const axis = nearest ? topAxisDifference(item.features, nearest.item.features) : AXIS_KEYS[0];
  const raw = [
    { kind:"axis" as const, key:axis, label:`The ${axisPhrase(axis, item.features[axis])} mattered` },
    ...item.keywords.slice(0,2).map(key=>({kind:"tag" as const,key,label:`The ${key} element mattered`})),
    ...item.genres.slice(0,1).map(key=>({kind:"genre" as const,key,label:`The ${key.toLowerCase()} side mattered`}))
  ];
  return { direction, options:raw.slice(0,3), summary: direction === "negative"
    ? `Unexpected based on your ratings so far: Dossier expected this to fit${nearest ? ` near ${nearest.item.title}` : ""}. Something else may matter here.`
    : `This sits outside the patterns Dossier currently associates with your favourites. It may reveal an underrepresented part of your taste.` };
}

export function explainRating(item: TmdbItem, rating: Rating, before: Prediction): string {
  const kind = ratingKind(rating); const strength = Math.abs(ratingWeight(rating));
  const pattern = item.keywords.slice(0,2).join(" and ") || item.genres.slice(0,2).join(" and ") || "this pattern";
  if (kind === "not_interested") return `Dossier will treat this as lack of interest around ${pattern.toLowerCase()}, not as disliking the whole ${item.genres[0]?.toLowerCase() ?? "category"}.`;
  if (kind === "watchlist") return `Watchlist interest is weak positive evidence, not a claim that you already like ${item.title}.`;
  if (kind === "neutral") return `Neutral adds coverage without pulling your taste model towards or away from ${item.title}.`;
  const intensity = strength >= 2 ? "strong" : strength >= 1.5 ? "meaningful" : "some";
  const direction = kind === "like" ? "positive" : "negative";
  const change = (before.expected === "like" && kind === "dislike") || (before.expected === "dislike" && kind === "like") ? " This contradicts the current guess, so Dossier will weaken that assumption." : "";
  return `This is ${intensity} ${direction} evidence around ${pattern.toLowerCase()}.${change}`;
}

export type TasteArea = { name:string; status:"strong"|"learning"; why:string };
export function tasteSnapshot(entries: RatingEntry[]): TasteArea[] {
  const map = new Map<string, RatingEntry[]>();
  for (const e of entries) for (const g of e.item.genres) map.set(g,[...(map.get(g)??[]),e]);
  return [...map].map(([name, xs])=>{
    const pos=xs.filter(x=>ratingWeight(x.rating)>0).length, neg=xs.filter(x=>ratingWeight(x.rating)<0).length;
    const strong=xs.length>=4 && Math.max(pos,neg)/xs.length>=.7;
    return {name,status:strong?"strong":"learning",why:strong?`${xs.length} responses point mostly in the same direction.`:xs.length<4?`Only ${xs.length} response${xs.length===1?"":"s"} so far.`:`Positive, negative, and indifferent signals are mixed.`} as TasteArea;
  }).sort((a,b)=>a.status.localeCompare(b.status)||a.name.localeCompare(b.name));
}

export function shouldStopActiveLearning(entries: RatingEntry[], bestValue: number): {stop:boolean; reason:string} {
  const recent=entries.slice(-8); const settled=recent.length===8 && recent.filter(e=>Math.abs(ratingWeight(e.rating))>=1).length>=6;
  return {stop:entries.length>=20 && settled && bestValue<.85, reason:"The areas you have covered are producing little new uncertainty, so another proactive question is unlikely to add much right now."};
}
