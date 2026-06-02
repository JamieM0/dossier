import type { FeatureVector } from "../lens.js";

export type TmdbMedium = "movie" | "tv";

export type TmdbItem = {
  id: number;
  medium: TmdbMedium;
  title: string;
  year: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  genreIds: number[];
  genres: string[];
  posterPath: string | null;
  overview: string;
  runtime: number | null;
  keywords: string[];
  features: FeatureVector;
};

export type TmdbListResult = {
  page: number;
  totalPages: number;
  items: TmdbItem[];
};
