export type DossierSettings = {
  theme: string;
  dyslexiaMode: boolean;
  startOnLogin: boolean;
  autoUpdatesEnabled: boolean;
  skippedUpdateVersion: string | null;
  sidebarCollapsed: boolean;
  showingWelcome: boolean;
  [key: string]: unknown;
};

/** -1 = thumbs down, +1 = thumbs up. */
export type Rating = -1 | 1;

export type PairwiseChoice = {
  winnerId: number;
  loserId: number;
  ts: number;
};

export type PreferencesPayload = {
  ratings: Record<string, Rating>;
  pairwise: PairwiseChoice[];
  skipped: number[];
};

/** Feature vector keys match `AXES` in
 * tools/catalogue-builder/feature_schema.py. */
export type FeatureVector = {
  pacing: number;
  tone_register: number;
  ending_warmth: number;
  emotional_intensity: number;
  complexity: number;
  scope: number;
  realism: number;
  darkness: number;
  thematic_weight: number;
  character_focus: number;
  moral_clarity: number;
  structure: number;
};

export type AxisDescriptor = {
  key: keyof FeatureVector;
  label: string;
  pos: string;
  neg: string;
};

export type FilmIndexEntry = {
  id: number;
  title: string;
  year: number | null;
  popularity: number;
  rating: number | null;
  poster_url: string | null;
  genres: string[];
  features: FeatureVector;
};

export type CatalogueIndex = {
  version: number;
  axes: AxisDescriptor[];
  films: FilmIndexEntry[];
};

export type FilmDetail = FilmIndexEntry & {
  slug: string;
  duration_min: number | null;
  country: string[];
  story: string;
  themes: string[];
  similar_ids: number[];
};
