import { AXIS_KEYS, type AxisKey, type FeatureVector, type Rating, type TmdbItem } from "@dossier/domain";

export type Persona = {
  id: string;
  description: string;
  weights: Partial<Record<AxisKey, number>>;
  genres: Record<string, number>;
  tags: Record<string, number>;
  mood?: "quiet" | "energetic";
};

type Family = { name: string; genre: string; tags: string[]; axes: Partial<FeatureVector> };
const families: Family[] = [
  { name: "Philosophical signal", genre: "Science Fiction", tags: ["philosophical", "quiet"], axes: { pacing: -.8, complexity: .8, scope: -.5, thematic_weight: .9, character_focus: .7, tone: -.5 } },
  { name: "Space spectacle", genre: "Science Fiction", tags: ["action", "spectacle"], axes: { pacing: .9, complexity: -.3, scope: .9, character_focus: -.6, tone: .4 } },
  { name: "Intimate future", genre: "Science Fiction", tags: ["romance", "quiet"], axes: { pacing: -.7, emotional_intensity: .8, scope: -.9, character_focus: .9, complexity: .4 } },
  { name: "Haunted house", genre: "Horror", tags: ["atmospheric", "no-gore"], axes: { pacing: -.5, tone: -.8, emotional_intensity: .6, scope: -.7, moral_clarity: -.6 } },
  { name: "Slasher", genre: "Horror", tags: ["gore", "violent"], axes: { pacing: .8, tone: -.9, emotional_intensity: .8, complexity: -.6 } },
  { name: "Wry comedy", genre: "Comedy", tags: ["witty", "character"], axes: { tone: .8, pacing: .2, character_focus: .8, scope: -.6 } },
  { name: "Broad comedy", genre: "Comedy", tags: ["broad", "silly"], axes: { tone: .9, pacing: .7, complexity: -.8, thematic_weight: -.8 } },
  { name: "Domestic drama", genre: "Drama", tags: ["intimate", "quiet"], axes: { pacing: -.7, emotional_intensity: .8, scope: -.9, realism: .8, character_focus: .9 } },
  { name: "Historical epic", genre: "Drama", tags: ["epic", "historical"], axes: { pacing: .3, scope: .9, realism: .7, thematic_weight: .7 } },
  { name: "Puzzle thriller", genre: "Thriller", tags: ["puzzle", "nolan"], axes: { pacing: .5, complexity: .9, structure: .8, thematic_weight: .5 } },
  { name: "Opaque puzzle", genre: "Thriller", tags: ["puzzle", "nolan", "tenet-like"], axes: { pacing: .9, complexity: 1, structure: 1, character_focus: -.8 } },
  { name: "Crime noir", genre: "Crime", tags: ["noir", "ambiguous"], axes: { tone: -.8, complexity: .5, moral_clarity: -.9, realism: .7 } },
  { name: "Animated wonder", genre: "Animation", tags: ["family", "warm"], axes: { tone: .8, emotional_intensity: .6, realism: -.8, moral_clarity: .8 } },
  { name: "Fantasy quest", genre: "Fantasy", tags: ["adventure", "epic"], axes: { scope: .9, realism: -.9, pacing: .6, moral_clarity: .7 } },
  { name: "Nature study", genre: "Documentary", tags: ["quiet", "nature"], axes: { pacing: -.8, realism: 1, thematic_weight: .5, tone: .4 } },
  { name: "Music portrait", genre: "Documentary", tags: ["music", "intimate"], axes: { realism: 1, emotional_intensity: .7, character_focus: .8 } }
];

function hash(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}

export function catalogue(): TmdbItem[] {
  const random = hash(782341);
  return families.flatMap((family, familyIndex) => Array.from({ length: 12 }, (_, variant) => {
    const features = Object.fromEntries(AXIS_KEYS.map((axis) => {
      const base = family.axes[axis] ?? (random() - .5) * .5;
      return [axis, Math.max(-1, Math.min(1, base + (random() - .5) * .5))];
    })) as FeatureVector;
    const tags = [...family.tags];
    if (variant % 4 === 0) tags.push("slow");
    if (variant % 5 === 0) tags.push("experimental");
    return {
      id: 900000 + familyIndex * 100 + variant + 1, medium: "movie" as const,
      title: `${family.name} ${variant + 1}`, year: 1985 + ((familyIndex * 7 + variant * 3) % 40),
      voteAverage: 5.5 + random() * 3.5, voteCount: 100 + variant * 45,
      popularity: 20 + ((variant * 31 + familyIndex * 17) % 150), genreIds: [], genres: [family.genre],
      posterPath: null, overview: `${family.name} synthetic title`, runtime: 85 + variant * 5,
      keywords: tags, collection: null, directorIds: [], creatorIds: [], features
    };
  }));
}

const definitions: Array<Omit<Persona, "id">> = [
  { description: "Quiet philosophical science fiction; rejects spectacle", weights: { pacing: -1.2, complexity: 1, thematic_weight: 1, character_focus: .5 }, genres: { "Science Fiction": .6 }, tags: { action: -2, quiet: .7 } },
  { description: "Horror atmosphere without gore", weights: { pacing: -.5, tone: -.5 }, genres: { Horror: 1.4 }, tags: { gore: -3, atmospheric: 1 } },
  { description: "Puzzle thrillers except opaque action puzzles", weights: { complexity: 1, structure: .5, character_focus: .5 }, genres: { Thriller: .8 }, tags: { nolan: .8, "tenet-like": -3 } },
  { description: "Intimate stories across disliked genres", weights: { scope: -1.4, character_focus: 1.2, emotional_intensity: .6 }, genres: { "Science Fiction": -.6, Horror: -.6 }, tags: { intimate: 1.2, quiet: .6 } },
  { description: "Likes almost everything", weights: {}, genres: {}, tags: { gore: -.5 } },
  { description: "Split between dark noir and warm animation", weights: { moral_clarity: -.2 }, genres: { Crime: 1.5, Animation: 1.5 }, tags: { noir: .8, warm: .8 } },
  { description: "Mood shifts between contemplative and kinetic", weights: { complexity: .5 }, genres: { Drama: .6, Thriller: .6 }, tags: { quiet: .6, action: .6 }, mood: "quiet" },
  { description: "Broad comedy and action", weights: { pacing: 1, tone: 1 }, genres: { Comedy: 1, "Science Fiction": .4 }, tags: { broad: 1, philosophical: -1 } },
  { description: "Grounded character drama", weights: { realism: 1.2, character_focus: 1.2, scope: -.6 }, genres: { Drama: .9 }, tags: { spectacle: -1 } },
  { description: "Epic fantasy and historical drama", weights: { scope: 1.3, moral_clarity: .5 }, genres: { Fantasy: 1, Drama: .5 }, tags: { epic: 1.2 } },
  { description: "Formal experiments with low sentiment", weights: { structure: 1.3, complexity: 1, emotional_intensity: -.7 }, genres: { Thriller: .5 }, tags: { experimental: 1 } },
  { description: "Warm animation and witty comedy", weights: { tone: 1, character_focus: .8 }, genres: { Animation: 1, Comedy: .8 }, tags: { warm: 1, witty: .7 } },
  { description: "Documentaries over fictional spectacle", weights: { realism: 1.4, pacing: -.6 }, genres: { Documentary: 1.4 }, tags: { spectacle: -1.5 } },
  { description: "Bleak ambiguity", weights: { tone: -1, moral_clarity: -1.2, complexity: .6 }, genres: { Crime: .8, Horror: .5 }, tags: { ambiguous: .8 } },
  { description: "Music and emotional portraits", weights: { emotional_intensity: 1.2, character_focus: 1 }, genres: { Documentary: .6, Drama: .6 }, tags: { music: 1.4 } },
  { description: "Fast but thoughtful action", weights: { pacing: 1.2, complexity: .6, scope: .4 }, genres: { Thriller: 1, "Science Fiction": .5 }, tags: { puzzle: .7, broad: -1 } },
  { description: "Slow nature and domestic observation", weights: { pacing: -1.4, realism: .9, scope: -.8 }, genres: { Documentary: .8, Drama: .7 }, tags: { nature: 1, quiet: .7 } },
  { description: "Genre loyal horror fan", weights: { tone: -.6 }, genres: { Horror: 2 }, tags: { gore: .5, atmospheric: .5 } },
  { description: "Prefers classics of every genre", weights: { structure: -.5, tone: .2 }, genres: {}, tags: { experimental: -1 } },
  { description: "Science fiction with intimate romance", weights: { realism: -.7, character_focus: 1, scope: -1 }, genres: { "Science Fiction": 1 }, tags: { romance: 1.2, action: -1.4 } },
  { description: "Comedy only when dry and character driven", weights: { tone: .5, character_focus: 1 }, genres: { Comedy: .7 }, tags: { witty: 1.4, broad: -2 } },
  { description: "Loves epic scale but dislikes action", weights: { scope: 1.2, thematic_weight: .8, pacing: -.8 }, genres: { Drama: .7, Fantasy: .7 }, tags: { epic: 1, action: -1.5 } },
  { description: "Ambiguous crime and philosophical science fiction", weights: { complexity: .8, moral_clarity: -.8 }, genres: { Crime: .8, "Science Fiction": .8 }, tags: { ambiguous: .8, philosophical: .8 } },
  { description: "Polarised tastes, rejecting middling films", weights: { emotional_intensity: 1, thematic_weight: 1 }, genres: { Drama: .7, Horror: .7 }, tags: { broad: -1.2, spectacle: -1.2 } }
];

export function personas(variations = 10): Persona[] {
  const base = definitions.map((definition, index) => ({ ...definition, id: `curated-${String(index + 1).padStart(2, "0")}` }));
  return [...base, ...base.flatMap((person, index) => Array.from({ length: variations }, (_, variant) => {
    const random = hash((index + 1) * 1000 + variant);
    return {
      ...person, id: `${person.id}-v${variant + 1}`,
      description: `${person.description} (variation ${variant + 1})`,
      weights: Object.fromEntries(Object.entries(person.weights).map(([key, value]) => [key, value + (random() - .5) * .5])) as Persona["weights"],
      genres: Object.fromEntries(Object.entries(person.genres).map(([key, value]) => [key, value + (random() - .5) * .5])),
      tags: Object.fromEntries(Object.entries(person.tags).map(([key, value]) => [key, value + (random() - .5) * .5]))
    };
  }))];
}

export function truth(person: Persona, item: TmdbItem, variation = 0): Rating {
  let utility = person.description.startsWith("Likes almost everything") ? 1.8 : 0;
  for (const [axis, weight] of Object.entries(person.weights)) utility += item.features[axis as AxisKey] * weight!;
  for (const genre of item.genres) utility += person.genres[genre] ?? 0;
  for (const tag of item.keywords) utility += person.tags[tag] ?? 0;
  if (person.description.startsWith("Prefers classics")) utility += item.year! < 2000 ? 1.4 : -1.2;
  if (person.description.startsWith("Polarised")) utility -= Math.abs(item.features.emotional_intensity) < .4 ? 1.5 : 0;
  if (person.mood) utility += (variation % 2 === 0 ? -1 : 1) * item.features.pacing * .8;
  if (utility >= 2.4) return 3;
  if (utility >= 1.1) return 2;
  if (utility >= .25) return 1;
  if (utility <= -2.4) return -3;
  if (utility <= -1.1) return -2;
  if (utility <= -.25) return -1;
  return 0;
}
