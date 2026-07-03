import type { AxisKey, ScoringParams } from "$lib/recommender";

export type DialKey =
  | "qualityBias"
  | "dislikeAversion"
  | "tasteGranularity"
  | "safeAdventurous"
  | "mainstreamObscure"
  | "recencyBias"
  | "runtimePreference"
  | "ratingRecencyWeighting"
  | "explorationSerendipity"
  | "pace"
  | "mood"
  | "emotionalIntensity"
  | "complexity"
  | "realism"
  | "characterFocus"
  | "moralAmbiguity"
  | "experimentalStructure";

export type DialGroup = "core" | "discovery" | "axis";

export type DialDef = {
  key: DialKey;
  label: string;
  group: DialGroup;
  /** One sentence: what low vs. high does. */
  description: string;
  /** Dial position (1-100) that reproduces today's un-tuned behavior. */
  defaultValue: number;
};

/** The 8 feature-axis dials map 1:1 onto AXIS_KEYS, minus scope and
 * thematic_weight (kept implicit at weight 1 — the 10-axis lens has two
 * more axes than we want as top-level panel rows). */
const AXIS_DIAL_TO_KEY: Record<
  "pace" | "mood" | "emotionalIntensity" | "complexity" | "realism" | "characterFocus" | "moralAmbiguity" | "experimentalStructure",
  AxisKey
> = {
  pace: "pacing",
  mood: "tone",
  emotionalIntensity: "emotional_intensity",
  complexity: "complexity",
  realism: "realism",
  characterFocus: "character_focus",
  moralAmbiguity: "moral_clarity",
  experimentalStructure: "structure"
};

/** Every dial defaults to the position that reproduces
 * DEFAULT_SCORING_PARAMS exactly — see convertDialsToParams. Order here
 * is display order within each group. */
export const DIAL_DEFS: DialDef[] = [
  {
    key: "qualityBias",
    label: "Quality Bias",
    group: "core",
    description:
      "Low favors your closest taste match even if it's poorly reviewed; high favors well-reviewed titles even when they're a looser taste fit.",
    defaultValue: 20
  },
  {
    key: "dislikeAversion",
    label: "Dislike Aversion",
    group: "core",
    description:
      "Low lets titles through even if they resemble something you disliked; high aggressively filters out anything close to a past dislike.",
    defaultValue: 40
  },
  {
    key: "tasteGranularity",
    label: "Taste Granularity",
    group: "core",
    description:
      "Low merges your ratings into a few broad taste buckets; high keeps them as many narrow, distinct clusters for sharper — sometimes weirder — matches.",
    defaultValue: 50
  },
  {
    key: "safeAdventurous",
    label: "Safe vs. Adventurous",
    group: "core",
    description:
      "Low only recommends titles that closely match a single one of your tastes; high blends signals across several of your tastes at once, surfacing less obvious picks.",
    defaultValue: 29
  },
  {
    key: "mainstreamObscure",
    label: "Mainstream ↔ Obscure",
    group: "discovery",
    description: "Low favors under-the-radar titles; high favors popular, widely-watched ones.",
    defaultValue: 50
  },
  {
    key: "recencyBias",
    label: "Recency Bias",
    group: "discovery",
    description: "Low favors older releases; high favors recent ones.",
    defaultValue: 50
  },
  {
    key: "runtimePreference",
    label: "Runtime Preference",
    group: "discovery",
    description: "Low favors shorter titles or episodes; high favors longer ones.",
    defaultValue: 50
  },
  {
    key: "ratingRecencyWeighting",
    label: "Rating Recency Weighting",
    group: "discovery",
    description:
      "Low weighs all your ratings equally regardless of age; high lets your most recent ratings dominate your taste profile as old ones fade.",
    defaultValue: 1
  },
  {
    key: "explorationSerendipity",
    label: "Exploration / Serendipity",
    group: "discovery",
    description: "Low keeps ranking fully deterministic; high shuffles in randomness so unexpected titles surface.",
    defaultValue: 1
  },
  {
    key: "pace",
    label: "Pace",
    group: "axis",
    description: "High makes your fast/slow pacing preference matter much more when ranking; low ignores pacing entirely.",
    defaultValue: 50
  },
  {
    key: "mood",
    label: "Mood",
    group: "axis",
    description:
      "High strongly separates light, playful, uplifting titles from dark, serious, bleak ones; low ignores tone.",
    defaultValue: 50
  },
  {
    key: "emotionalIntensity",
    label: "Emotional Intensity",
    group: "axis",
    description:
      "High shifts strongly toward matching raw, moving, intense picks vs. cooler, detached ones; low ignores emotional intensity.",
    defaultValue: 50
  },
  {
    key: "complexity",
    label: "Complexity",
    group: "axis",
    description: "High tunes strongly between cerebral, intricate picks and simple, straightforward ones; low ignores complexity.",
    defaultValue: 50
  },
  {
    key: "realism",
    label: "Realism",
    group: "axis",
    description:
      "High strongly separates grounded, true-to-life picks from fantasy, sci-fi, or surreal ones; low ignores realism.",
    defaultValue: 50
  },
  {
    key: "characterFocus",
    label: "Character Focus",
    group: "axis",
    description:
      "High strongly promotes matching on intimate character studies vs. ensemble, plot-led stories; low ignores character focus.",
    defaultValue: 50
  },
  {
    key: "moralAmbiguity",
    label: "Moral Ambiguity",
    group: "axis",
    description:
      "High makes heroic, clear-cut vs. cynical, antihero material matter much more; low ignores moral clarity.",
    defaultValue: 50
  },
  {
    key: "experimentalStructure",
    label: "Experimental Structure",
    group: "axis",
    description:
      "High can strongly surface or suppress non-linear, anthology, twisty, art-house structure; low ignores structure.",
    defaultValue: 50
  }
];

export const DIAL_GROUP_LABELS: Record<DialGroup, string> = {
  core: "Core Scoring",
  discovery: "Discovery",
  axis: "Feature Axes"
};

export function defaultDialValues(): Record<DialKey, number> {
  const out = {} as Record<DialKey, number>;
  for (const def of DIAL_DEFS) out[def.key] = def.defaultValue;
  return out;
}

/** Converts 1-100 dial positions into the actual ScoringParams the
 * recommender consumes. Each formula is chosen so that defaultDialValues()
 * round-trips to DEFAULT_SCORING_PARAMS exactly (see recommender.test.ts
 * for the equivalent property on the scoring side). */
export function convertDialsToParams(values: Record<DialKey, number>): ScoringParams {
  const axisWeights: Partial<Record<AxisKey, number>> = {};
  for (const [dialKey, axisKey] of Object.entries(AXIS_DIAL_TO_KEY) as [keyof typeof AXIS_DIAL_TO_KEY, AxisKey][]) {
    axisWeights[axisKey] = values[dialKey] / 50;
  }

  // Arithmetic is ordered (dial * max) / 100 rather than (dial / 100) *
  // max deliberately: with the chosen defaults this lands on the exact
  // float value of the underlying constant (e.g. 40 * 1.5 / 100 === 0.6),
  // where the other grouping picks up a 1-ULP rounding error. See
  // recommendation-dials.test.ts's exactness assertion.
  return {
    qualityWeight: (values.qualityBias * 0.25) / 100,
    dislikePenalty: (values.dislikeAversion * 1.5) / 100,
    clusterMergeThreshold: 0.5 + (values.tasteGranularity * 0.5) / 100,
    topKClusters: Math.round(1 + (values.safeAdventurous * 7) / 100),
    axisWeights,
    popularityBias: (values.mainstreamObscure - 50) / 50,
    recencyBias: (values.recencyBias - 50) / 50,
    runtimeBias: (values.runtimePreference - 50) / 50,
    ratingRecencyStrength: (values.ratingRecencyWeighting - 1) / 99,
    serendipity: (values.explorationSerendipity - 1) / 99
  };
}

class RecommendationDialsStore {
  values = $state<Record<DialKey, number>>(defaultDialValues());

  readonly params: ScoringParams = $derived(convertDialsToParams(this.values));

  readonly isDefault: boolean = $derived(DIAL_DEFS.every((def) => this.values[def.key] === def.defaultValue));

  set(key: DialKey, value: number): void {
    this.values = { ...this.values, [key]: value };
  }

  reset(): void {
    this.values = defaultDialValues();
  }

  async hydrateFromDesktop(): Promise<void> {
    const desktopSettings = await window.dossier?.settings.get();
    const stored = desktopSettings?.recommendationDials as Partial<Record<DialKey, number>> | undefined;
    if (!stored) return;
    const next = defaultDialValues();
    for (const def of DIAL_DEFS) {
      const v = stored[def.key];
      if (typeof v === "number" && Number.isFinite(v)) next[def.key] = Math.max(1, Math.min(100, v));
    }
    this.values = next;
  }

  async persist(): Promise<void> {
    await window.dossier?.settings.set({ recommendationDials: this.values });
  }
}

export const recommendationDials = new RecommendationDialsStore();
