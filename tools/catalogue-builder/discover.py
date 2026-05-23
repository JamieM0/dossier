"""Discover a diverse pool of BestSimilar film URLs.

Walks a curated set of `/top/*` index pages (decades, genres, countries,
moods, plus a few cross-cutting niches) and paginates each one until it
stops returning new film IDs. Writes a deduped URL list to
`data/film-urls.txt`.

The goal is breadth: we deliberately pull from many narrow indexes
rather than a single "best of all time" list, so the catalogue covers
era / genre / region / popularity rather than over-indexing on the
mainstream canon.
"""
from __future__ import annotations

import argparse
import random
import re
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher


FILM_RE = re.compile(r'item-movie clearfix" data-id="(\d+)"')
SLUG_RE = re.compile(r'href="/movies/(\d+)-([a-z0-9\-]+)"')

# All index URLs we walk. Each one paginates; we stop on a page with no
# new IDs. Lists are intentionally over-broad — duplicates across indexes
# are deduped at the end, but we want every (era × genre × region) cell
# to be hit at least once.

DECADES = [
    # Year-based "best of" pages exist per year, all the way back to silent era.
    *[f"best-movies-of-{y}" for y in range(1930, 2026)],
]

GENRES = [
    "best-drama-movies", "best-comedy-movies", "best-thriller-movies",
    "best-romance-movies", "best-action-movies", "best-crime-movies",
    "best-sci-fi-movies", "best-horror-movies", "best-fantasy-movies",
    "best-adventure-movies", "best-mystery-movies", "best-animation-movies",
    "best-family-movies", "best-biography-movies", "best-history-movies",
    "best-war-movies", "best-western-movies", "best-musical-movies",
    "best-documentary-movies", "best-sport-movies", "best-music-movies",
    "best-film-noir-movies",
]

COUNTRIES = [
    "best-american-movies", "best-british-movies", "best-french-movies",
    "best-italian-movies", "best-german-movies", "best-spanish-movies",
    "best-japanese-movies", "best-korean-movies", "best-chinese-movies",
    "best-indian-movies", "best-russian-movies", "best-canadian-movies",
    "best-australian-movies", "best-mexican-movies", "best-brazilian-movies",
    "best-swedish-movies", "best-danish-movies", "best-polish-movies",
    "best-iranian-movies", "best-hong-kong-movies", "best-argentinian-movies",
    "best-irish-movies", "best-new-zealand-movies", "best-turkish-movies",
    "best-israeli-movies", "best-belgian-movies", "best-dutch-movies",
    "best-norwegian-movies", "best-finnish-movies", "best-czech-movies",
    "best-romanian-movies", "best-greek-movies", "best-portuguese-movies",
    "best-thai-movies", "best-vietnamese-movies", "best-indonesian-movies",
    "best-filipino-movies", "best-african-movies",
]

# Mood / style / theme axes (BestSimilar's broad style buckets, used to
# fish out lesser-known films that don't surface in genre top lists).
MOODS = [
    "best-feel-good-movies", "best-disturbing-movies", "best-uplifting-movies",
    "best-melancholic-movies", "best-suspenseful-movies", "best-romantic-movies",
    "best-cerebral-movies", "best-touching-movies", "best-funny-movies",
    "best-serious-movies", "best-emotional-movies", "best-realistic-movies",
    "best-surreal-movies", "best-psychological-movies", "best-philosophical-movies",
    "best-sentimental-movies", "best-dark-movies", "best-stylized-movies",
    "best-atmospheric-movies", "best-violent-movies", "best-erotic-movies",
    "best-intellectual-movies", "best-thought-provoking-movies",
    "best-coming-of-age-movies", "best-cult-movies",
]


def index_urls() -> list[str]:
    base = "https://bestsimilar.com/top/"
    return [base + slug for slug in (DECADES + GENRES + COUNTRIES + MOODS)]


def fetch_page(url: str, retries: int = 2) -> str | None:
    for attempt in range(retries + 1):
        try:
            r = Fetcher.get(url)
            if r.status == 200:
                return r.body.decode("utf-8", "replace") if isinstance(r.body, bytes) else r.body
            if r.status in (301, 302):
                # bestsimilar silently redirects past-end pagination back to page 1
                return None
            if r.status == 404:
                return None
        except Exception:  # noqa: BLE001
            pass
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None


def walk_index(base_url: str, *, max_pages: int = 20, delay: float = 0.8) -> set[tuple[int, str]]:
    """Walk one index, returning the set of (film_id, slug) tuples it yielded."""
    out: set[tuple[int, str]] = set()
    prev_page_ids: set[int] | None = None
    for page in range(1, max_pages + 1):
        url = base_url if page == 1 else f"{base_url}?page={page}"
        html = fetch_page(url)
        if html is None:
            break
        page_ids = set(int(x) for x in FILM_RE.findall(html))
        if not page_ids:
            break
        if prev_page_ids is not None and page_ids == prev_page_ids:
            # Server falling back to page 1 means we've gone past the end.
            break
        prev_page_ids = page_ids

        # Capture slugs by joining ids with hrefs found on the same page.
        slug_map = {int(i): s for i, s in SLUG_RE.findall(html)}
        before = len(out)
        for film_id in page_ids:
            slug = slug_map.get(film_id, "")
            out.add((film_id, slug))
        added = len(out) - before
        print(f"  page {page}: +{added} (cum {len(out)})", file=sys.stderr)
        if added == 0:
            break
        time.sleep(delay * random.uniform(0.5, 1.5))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path,
                    help="Output URL list (one per line)")
    ap.add_argument("--max-pages", type=int, default=15)
    ap.add_argument("--delay", type=float, default=0.8)
    ap.add_argument("--limit-indexes", type=int, default=0,
                    help="Process only first N index URLs (0 = all). Useful for dry runs.")
    args = ap.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    indexes = index_urls()
    if args.limit_indexes:
        indexes = indexes[: args.limit_indexes]

    seen: dict[int, str] = {}
    for i, url in enumerate(indexes, 1):
        print(f"[{i}/{len(indexes)}] {url}", file=sys.stderr)
        try:
            yielded = walk_index(url, max_pages=args.max_pages, delay=args.delay)
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL: {exc}", file=sys.stderr)
            continue
        for film_id, slug in yielded:
            # Keep first non-empty slug we see.
            if film_id not in seen or (not seen[film_id] and slug):
                seen[film_id] = slug
        print(f"  -> total unique: {len(seen)}", file=sys.stderr)
        # Persist after every index so a crash doesn't lose progress.
        with args.out.open("w") as fh:
            for film_id in sorted(seen):
                slug = seen[film_id]
                fh.write(f"https://bestsimilar.com/movies/{film_id}-{slug}\n"
                         if slug else f"https://bestsimilar.com/movies/{film_id}\n")

    print(f"\ndone. {len(seen)} unique films written to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
