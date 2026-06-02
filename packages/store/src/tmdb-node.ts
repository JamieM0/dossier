/** Node-side wiring for the isomorphic domain TMDB client: a disk-backed
 * cache for long-lived metadata (item detail + keywords, genre lists),
 * mirroring the poster cache's long retention. The client itself and all
 * transforms live in @dossier/domain; only the fs persistence is here. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TmdbClient, type TmdbCache } from "@dossier/domain";

/** Long-lived metadata is kept on disk for at least this long before we
 * even consider re-fetching it. Matches the poster retention floor. */
const DISK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export class FsTmdbCache implements TmdbCache {
  private readonly metaDir: string;

  constructor(cacheDir: string) {
    this.metaDir = join(cacheDir, "meta");
    mkdirSync(this.metaDir, { recursive: true });
  }

  private cacheFile(key: string): string {
    const hash = createHash("sha1").update(key).digest("hex");
    return join(this.metaDir, `${hash}.json`);
  }

  async get(key: string): Promise<unknown | undefined> {
    const file = this.cacheFile(key);
    if (!existsSync(file)) return undefined;
    const age = Date.now() - statSync(file).mtimeMs;
    if (age >= DISK_TTL_MS) return undefined;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return undefined; // corrupt cache file → treat as a miss
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    writeFileSync(this.cacheFile(key), JSON.stringify(value));
  }
}

/** Construct a TMDB client backed by an on-disk metadata cache under
 * `cacheDir`. The token is supplied per-call (read from the keychain). */
export function createTmdbClient(token: string, cacheDir: string): TmdbClient {
  return new TmdbClient({ token, cache: new FsTmdbCache(cacheDir) });
}
