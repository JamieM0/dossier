/** Entertainment lens: maps a TMDB item to a 10-axis, medium-agnostic
 * feature vector in [-1, 1].
 *
 * This is the on-device successor to the old offline Python
 * `feature_schema.py`. Two differences:
 *   1. The three redundant mood axes (tone_register / darkness /
 *      ending_warmth) are merged into one `tone` axis (+1 light/playful/
 *      uplifting … -1 dark/serious/bleak/violent).
 *   2. Signal comes from three sources instead of curated BestSimilar
 *      tags: TMDB genres (coarse priors), TMDB keywords, and the
 *      overview prose. Keywords are richer than BestSimilar's truncated
 *      previews, and genre priors give every item a non-empty vector
 *      even before keywords are fetched.
 *
 * Keys MUST match FeatureVector in apps/dossier-ui/src/lib/types.ts and
 * AXIS_KEYS in recommender.ts. */

export const AXIS_KEYS = [
  "pacing",
  "tone",
  "emotional_intensity",
  "complexity",
  "scope",
  "realism",
  "thematic_weight",
  "character_focus",
  "moral_clarity",
  "structure"
] as const;

export type AxisKey = (typeof AXIS_KEYS)[number];
export type FeatureVector = Record<AxisKey, number>;

type Axis = {
  key: AxisKey;
  positive: string[];
  negative: string[];
};

/** Keyword/overview term maps. Substring, case-insensitive; each term
 * counts at most once per item. Low recall per term is fine — items
 * carry many keywords. */
const AXES: Axis[] = [
  {
    key: "pacing",
    positive: [
      "fast paced", "fast-paced", "action", "thrilling", "exciting", "frantic",
      "kinetic", "breathless", "intense", "chase", "shootout", "thriller", "heist"
    ],
    negative: [
      "slow", "slow paced", "slow-paced", "contemplative", "meditative",
      "atmospheric", "quiet", "deliberate", "leisurely", "slow burn"
    ]
  },
  {
    // Merged tone: +light/playful/uplifting  -dark/serious/bleak/violent
    key: "tone",
    positive: [
      "comedy", "funny", "humorous", "witty", "absurd", "screwball", "satire",
      "satirical", "lighthearted", "silly", "comic", "feel good", "feel-good",
      "uplifting", "heartwarming", "hopeful", "happy ending", "inspirational",
      "redemption", "sweet", "wholesome", "cheerful", "family", "fun"
    ],
    negative: [
      "serious", "grim", "solemn", "somber", "sober", "heavy", "tragic",
      "dramatic", "bleak", "depressing", "downbeat", "nihilistic", "pessimistic",
      "hopeless", "dark", "disturbing", "unsettling", "creepy", "macabre",
      "violent", "brutal", "graphic", "horror", "gore", "twisted", "sinister",
      "menacing", "noir"
    ]
  },
  {
    key: "emotional_intensity",
    positive: [
      "emotional", "intense", "powerful", "wrenching", "harrowing", "devastating",
      "heart-wrenching", "moving", "touching", "tearjerker", "raw", "visceral",
      "romance", "love", "grief", "loss"
    ],
    negative: [
      "detached", "cool", "clinical", "cerebral", "cold", "distant", "ironic",
      "deadpan", "restrained"
    ]
  },
  {
    key: "complexity",
    positive: [
      "cerebral", "complex", "intricate", "labyrinthine", "mind bending",
      "mind-bending", "puzzle", "twists and turns", "non-linear", "nonlinear",
      "ambiguous", "philosophical", "thought provoking", "thought-provoking",
      "intellectual", "dense", "challenging", "mystery"
    ],
    negative: [
      "simple", "straightforward", "linear", "predictable", "by the numbers",
      "formulaic", "conventional", "easy to follow"
    ]
  },
  {
    key: "scope",
    positive: [
      "epic", "sweeping", "grand", "vast", "monumental", "ensemble", "blockbuster",
      "war", "saga", "spectacle", "historical epic", "battle", "empire"
    ],
    negative: [
      "intimate", "small", "personal", "chamber", "minimalist", "interior",
      "domestic", "two-hander", "low key", "slice of life"
    ]
  },
  {
    key: "realism",
    positive: [
      "fantasy", "fantastical", "magical", "magic", "supernatural", "surreal",
      "sci-fi", "science fiction", "futuristic", "dystopian", "alternate reality",
      "fairy tale", "myth", "mythological", "superhero", "dreamlike", "aliens",
      "space", "monster"
    ],
    negative: [
      "realistic", "naturalistic", "slice of life", "slice-of-life", "documentary",
      "docudrama", "biographical", "true story", "based on a true story",
      "kitchen sink", "biography"
    ]
  },
  {
    key: "thematic_weight",
    positive: [
      "philosophical", "philosophy", "existential", "existentialism", "spiritual",
      "religious", "meaningful", "profound", "morality", "ethical", "metaphysical",
      "introspective", "political"
    ],
    negative: [
      "escapist", "popcorn", "entertaining", "fun", "guilty pleasure", "lightweight",
      "frivolous", "summer movie", "feel-good"
    ]
  },
  {
    key: "character_focus",
    positive: [
      "character study", "character-driven", "character driven", "introspective",
      "biographical", "biopic", "one-man", "protagonist", "intimate character",
      "coming of age", "coming-of-age"
    ],
    negative: [
      "ensemble", "ensemble cast", "multiple storylines", "interconnected",
      "anthology", "hyperlink cinema", "multi-protagonist"
    ]
  },
  {
    key: "moral_clarity",
    positive: [
      "good vs evil", "heroic", "moral", "righteous", "clear-cut", "redemption",
      "inspirational", "noble", "superhero"
    ],
    negative: [
      "morally ambiguous", "ambiguous", "anti-hero", "antihero", "grey morality",
      "moral ambiguity", "nihilistic", "cynical", "complex morality",
      "shades of grey", "crime", "gangster"
    ]
  },
  {
    key: "structure",
    positive: [
      "non-linear", "nonlinear", "experimental", "fragmented", "fractured",
      "unconventional", "avant-garde", "art house", "art-house", "arthouse", "meta",
      "metafictional", "unreliable narrator", "twist ending", "anthology"
    ],
    negative: [
      "conventional", "traditional", "formulaic", "classical", "straightforward",
      "linear", "by the numbers"
    ]
  }
];

/** Genre → axis nudges. Coarse priors so an item has a meaningful vector
 * from genres alone (list items, before keywords are fetched). Values are
 * partial contributions in [-1, 1] blended with keyword/overview signal. */
const GENRE_PRIORS: Record<string, Partial<FeatureVector>> = {
  Action: { pacing: 0.7, emotional_intensity: 0.3, thematic_weight: -0.3 },
  Adventure: { pacing: 0.4, scope: 0.5, realism: 0.3 },
  Animation: { tone: 0.4, realism: 0.5 },
  Comedy: { tone: 0.8, thematic_weight: -0.4 },
  Crime: { tone: -0.4, moral_clarity: -0.5, pacing: 0.2 },
  Documentary: { realism: -0.9, thematic_weight: 0.5, pacing: -0.3 },
  Drama: { emotional_intensity: 0.5, tone: -0.3, character_focus: 0.4 },
  Family: { tone: 0.7, moral_clarity: 0.4 },
  Fantasy: { realism: 0.8, scope: 0.4 },
  History: { realism: -0.4, scope: 0.5, thematic_weight: 0.4 },
  Horror: { tone: -0.8, emotional_intensity: 0.5, pacing: 0.2 },
  Music: { emotional_intensity: 0.3, tone: 0.3 },
  Mystery: { complexity: 0.6, tone: -0.3, structure: 0.3 },
  Romance: { emotional_intensity: 0.6, tone: 0.3, character_focus: 0.3 },
  "Science Fiction": { realism: 0.8, complexity: 0.4, scope: 0.4 },
  "TV Movie": {},
  Thriller: { pacing: 0.6, tone: -0.4, emotional_intensity: 0.4 },
  War: { scope: 0.7, tone: -0.5, thematic_weight: 0.4, emotional_intensity: 0.4 },
  Western: { scope: 0.4, moral_clarity: -0.2 },
  // TV-specific genres
  "Action & Adventure": { pacing: 0.6, scope: 0.4 },
  Kids: { tone: 0.8, realism: 0.4 },
  News: { realism: -0.9 },
  Reality: { realism: -0.7, thematic_weight: -0.5 },
  "Sci-Fi & Fantasy": { realism: 0.8, scope: 0.4, complexity: 0.3 },
  Soap: { emotional_intensity: 0.5, tone: -0.2 },
  Talk: { realism: -0.8 },
  "War & Politics": { scope: 0.6, thematic_weight: 0.5, tone: -0.4 }
};

const LOOSE_DENOM = 3;

function zero(): FeatureVector {
  return Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as FeatureVector;
}

function countHits(corpus: string, terms: string[]): number {
  let hits = 0;
  for (const term of terms) if (corpus.includes(term)) hits++;
  return hits;
}

/** Compute the lens vector. `keywords` may be empty for list items, in
 * which case the vector leans on genre priors + overview. */
export function featureVector(input: {
  genres: string[];
  keywords: string[];
  overview: string;
}): FeatureVector {
  // Genre priors first.
  const out = zero();
  for (const g of input.genres) {
    const prior = GENRE_PRIORS[g];
    if (!prior) continue;
    for (const [k, v] of Object.entries(prior)) {
      out[k as AxisKey] += v ?? 0;
    }
  }

  // Keyword + overview signal. Keywords weigh more than prose.
  const kwCorpus = input.keywords.map((k) => k.toLowerCase()).join(" | ");
  const overview = (input.overview ?? "").toLowerCase();
  for (const axis of AXES) {
    const pos = countHits(kwCorpus, axis.positive) + 0.5 * countHits(overview, axis.positive);
    const neg = countHits(kwCorpus, axis.negative) + 0.5 * countHits(overview, axis.negative);
    if (pos === 0 && neg === 0) continue;
    const denom = Math.max(LOOSE_DENOM, pos + neg);
    out[axis.key] += (pos - neg) / denom;
  }

  // Clamp to [-1, 1].
  for (const k of AXIS_KEYS) out[k] = Math.max(-1, Math.min(1, Number(out[k].toFixed(3))));
  return out;
}
