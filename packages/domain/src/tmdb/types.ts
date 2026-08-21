import type { FeatureVector } from "../lens.js";

export type TmdbMedium = "movie" | "tv";

export type TmdbCollection = {
  id: number;
  name: string;
  posterPath: string | null;
  backdropPath: string | null;
};

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
  /** Movie franchise/collection membership, when TMDB exposes one. */
  collection: TmdbCollection | null;
  /** TMDB person IDs for credited directors (usually movies). */
  directorIds: number[];
  /** TMDB person IDs from a TV title's created_by relationship. */
  creatorIds: number[];
  features: FeatureVector;
};

export type TmdbListResult = {
  page: number;
  totalPages: number;
  items: TmdbItem[];
};
