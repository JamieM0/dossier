/** TMDB metadata client — isomorphic (runs in Node 18+ and the browser).
 *
 * Scope: JSON metadata only (genres, trending, discover, search, item
 * detail + keywords). Poster *images* are NOT fetched here.
 *
 * The user's TMDB v4 read token is supplied per-construction by the caller
 * (the app reads it from the OS keychain; the web build reads it from its
 * passphrase-encrypted library). It is never persisted here.
 *
 * Caching is injected. TMDB item records (detail+keywords) and genre lists
 * are effectively immutable, so they are stored in the long-lived `cache`
 * (the desktop wires an fs-backed disk cache; the browser may pass none or
 * an in-memory/Cache-API impl). Volatile listings (trending/discover/search)
 * use a short in-memory TTL only and never touch the injected cache. */
import { featureVector, type FeatureVector } from "../lens.js";
import type { TmdbItem, TmdbListResult, TmdbMedium } from "./types.js";

const BASE = "https://api.themoviedb.org/3";

/** Volatile listings: cheap in-memory cache so a burst of UI calls in one
 * session doesn't hammer TMDB, but nothing stale survives a restart. */
const LIST_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** In-memory mirror TTL for long-lived (disk-cached) resources. */
const META_MEM_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

/** Persistent cache for long-lived TMDB metadata. Implementations own their
 * own freshness policy (the desktop fs cache expires by file mtime); the
 * client treats a returned value as a hit and `undefined` as a miss. */
export interface TmdbCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

type MemEntry = { at: number; ttl: number; value: unknown };

function yearFrom(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const y = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}

export class TmdbConfigError extends Error {}

export type TmdbClientOptions = {
  token: string;
  cache?: TmdbCache;
};

export class TmdbClient {
  private mem = new Map<string, MemEntry>();
  private readonly token: string;
  private readonly cache: TmdbCache | undefined;

  constructor(options: TmdbClientOptions) {
    this.token = options.token;
    this.cache = options.cache;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/json"
    };
    if (this.token.length > 40) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  /** Raw GET against TMDB with layered caching.
   *  - `disk: true`  → consult/write the injected persistent cache, for
   *    stable resources (item detail, genre lists).
   *  - `disk: false` → in-memory only (LIST_TTL_MS), for volatile lists. */
  private async get<T>(
    path: string,
    params: Record<string, string | number | undefined>,
    opts: { disk: boolean }
  ): Promise<T> {
    const apiParams = { ...params };
    if (this.token.length <= 40) {
      apiParams.api_key = this.token;
    }

    const query = Object.entries(apiParams)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .sort()
      .join("&");
    const key = `${path}?${query}`;

    const memHit = this.mem.get(key);
    if (memHit && Date.now() - memHit.at < memHit.ttl) {
      return memHit.value as T;
    }

    if (opts.disk && this.cache) {
      const cached = await this.cache.get(key);
      if (cached !== undefined) {
        this.mem.set(key, { at: Date.now(), ttl: META_MEM_TTL_MS, value: cached });
        return cached as T;
      }
    }

    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ""}`, {
      headers: this.headers()
    });
    if (res.status === 401) {
      throw new TmdbConfigError("TMDB rejected the API token (401).");
    }
    if (!res.ok) {
      throw new Error(`TMDB ${path} failed: HTTP ${res.status}`);
    }
    const value = (await res.json()) as T;

    this.mem.set(key, {
      at: Date.now(),
      ttl: opts.disk ? META_MEM_TTL_MS : LIST_TTL_MS,
      value
    });
    if (opts.disk && this.cache) {
      try {
        await this.cache.set(key, value);
      } catch {
        // persistent cache is best-effort; an unwritable cache must not break reads
      }
    }
    return value;
  }

  /** Validate the token. Throws TmdbConfigError on a bad token. */
  async validate(): Promise<void> {
    await this.get<{ success: boolean }>("/authentication", {}, { disk: false });
  }

  /** Genre id → name map for a medium (cached long). */
  async genres(medium: TmdbMedium): Promise<Map<number, string>> {
    const data = await this.get<{ genres: Array<{ id: number; name: string }> }>(
      `/genre/${medium}/list`,
      {},
      { disk: true }
    );
    return new Map(data.genres.map((g) => [g.id, g.name]));
  }

  /** A page of trending items for the medium. Volatile. */
  async trending(medium: TmdbMedium, page = 1): Promise<TmdbListResult> {
    const data = await this.get<RawList>(
      `/trending/${medium}/week`,
      { page },
      { disk: false }
    );
    return this.toList(medium, data, await this.genres(medium));
  }

  /** Discover items, ranked by TMDB's chosen sort. Used as a candidate
   *  firehose (genre/popularity filters), NOT as a similarity oracle. */
  async discover(
    medium: TmdbMedium,
    params: {
      sortBy?: string | undefined;
      withGenres?: string | undefined;
      minVotes?: number | undefined;
      page?: number | undefined;
    }
  ): Promise<TmdbListResult> {
    const data = await this.get<RawList>(
      `/discover/${medium}`,
      {
        sort_by: params.sortBy ?? "popularity.desc",
        with_genres: params.withGenres,
        "vote_count.gte": params.minVotes ?? 200,
        page: params.page ?? 1,
        include_adult: "false"
      },
      { disk: false }
    );
    return this.toList(medium, data, await this.genres(medium));
  }

  /** Free-text search. `year` narrows movies by release year / tv by
   *  first-air year — used by the legacy rating migration. */
  async search(
    medium: TmdbMedium,
    query: string,
    year?: number
  ): Promise<TmdbListResult> {
    const yearParam =
      medium === "movie" ? { primary_release_year: year } : { first_air_date_year: year };
    const data = await this.get<RawList>(
      `/search/${medium}`,
      { query, include_adult: "false", ...yearParam },
      { disk: false }
    );
    return this.toList(medium, data, await this.genres(medium));
  }

  /** Full item record with keywords, normalized. Cached long —
   *  this is the canonical per-item fetch and feeds feature extraction. */
  async detail(medium: TmdbMedium, id: number): Promise<TmdbItem> {
    const raw = await this.get<RawDetail>(
      `/${medium}/${id}`,
      { append_to_response: "keywords" },
      { disk: true }
    );
    const kwList =
      medium === "movie" ? raw.keywords?.keywords : raw.keywords?.results;
    const genres = (raw.genres ?? []).map((g) => g.name);
    const keywords = (kwList ?? []).map((k) => k.name);
    const overview = raw.overview ?? "";
    return {
      id: raw.id,
      medium,
      title: raw.title ?? raw.name ?? "",
      year: yearFrom(raw.release_date ?? raw.first_air_date),
      voteAverage: raw.vote_average ?? null,
      voteCount: raw.vote_count ?? null,
      popularity: raw.popularity ?? null,
      genreIds: (raw.genres ?? []).map((g) => g.id),
      genres,
      posterPath: raw.poster_path ?? null,
      overview,
      runtime:
        raw.runtime ??
        (Array.isArray(raw.episode_run_time) ? raw.episode_run_time[0] ?? null : null),
      keywords,
      // Full vector — keywords available here.
      features: featureVector({ genres, keywords, overview })
    } satisfies TmdbItem;
  }

  private toList(
    medium: TmdbMedium,
    data: RawList,
    genreMap: Map<number, string>
  ): TmdbListResult {
    const items = (data.results ?? [])
      .filter((r) => r.poster_path) // skip posterless items — nothing to show
      .map<TmdbItem>((r) => {
        const genres = (r.genre_ids ?? []).map((g) => genreMap.get(g) ?? "").filter(Boolean);
        const overview = r.overview ?? "";
        return {
          id: r.id,
          medium,
          title: r.title ?? r.name ?? "",
          year: yearFrom(r.release_date ?? r.first_air_date),
          voteAverage: r.vote_average ?? null,
          voteCount: r.vote_count ?? null,
          popularity: r.popularity ?? null,
          genreIds: r.genre_ids ?? [],
          genres,
          posterPath: r.poster_path ?? null,
          overview,
          runtime: null,
          keywords: [],
          // Coarse vector — no keywords on list items, leans on genre
          // priors + overview. Refined when the detail is fetched.
          features: featureVector({ genres, keywords: [], overview })
        };
      });
    return { page: data.page ?? 1, totalPages: data.total_pages ?? 1, items };
  }
}

type RawListItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  poster_path?: string | null;
  overview?: string;
};

type RawList = {
  page?: number;
  total_pages?: number;
  results?: RawListItem[];
};

type RawDetail = RawListItem & {
  genres?: Array<{ id: number; name: string }>;
  runtime?: number;
  episode_run_time?: number[];
  keywords?: {
    keywords?: Array<{ id: number; name: string }>;
    results?: Array<{ id: number; name: string }>;
  };
};

// Re-export for callers that only need the type alongside the client.
export type { FeatureVector };
