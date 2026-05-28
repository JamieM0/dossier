"""Discover film URLs from BestSimilar's main /movies listing.

Walks https://bestsimilar.com/movies?page=N until pagination ends
(server 301-redirects past-end pages back to /movies). Writes a URL
list, optionally filtered to films we haven't already scraped.

Usage:
    python discover_movies_index.py --out data/movies-index-urls.txt \\
        --existing-dir data/films --target 2000
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher


FILM_RE = re.compile(r'item-movie clearfix" data-id="(\d+)"')
SLUG_RE = re.compile(r'href="/movies/(\d+)-([a-z0-9\-]+)"')


def fetch_page(url: str, retries: int = 2) -> tuple[int, str | None]:
    for attempt in range(retries + 1):
        try:
            r = Fetcher.get(url)
            status = r.status
            if status == 200:
                body = r.body
                if isinstance(body, bytes):
                    body = body.decode("utf-8", "replace")
                return status, body
            if status in (301, 302):
                return status, None
            if status == 404:
                return status, None
        except Exception:  # noqa: BLE001
            pass
        if attempt < retries:
            time.sleep(2 ** attempt)
    return 0, None


def existing_ids(dir_path: Path) -> set[int]:
    out: set[int] = set()
    if not dir_path.exists():
        return out
    for p in dir_path.iterdir():
        if not p.name.endswith(".json"):
            continue
        m = re.match(r"^(\d+)-", p.name)
        if m:
            out.add(int(m.group(1)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--existing-dir", type=Path, default=None,
                    help="Skip film ids that already have a JSON in this dir")
    ap.add_argument("--target", type=int, default=2000,
                    help="Stop once we have this many NEW (not-yet-scraped) URLs")
    ap.add_argument("--max-pages", type=int, default=200)
    ap.add_argument("--delay", type=float, default=0.5)
    args = ap.parse_args()

    skip = existing_ids(args.existing_dir) if args.existing_dir else set()
    print(f"existing ids to skip: {len(skip)}", file=sys.stderr)

    seen: dict[int, str] = {}
    new_count = 0
    prev_page_ids: set[int] | None = None

    for page in range(1, args.max_pages + 1):
        url = "https://bestsimilar.com/movies" if page == 1 \
              else f"https://bestsimilar.com/movies?page={page}"
        status, html = fetch_page(url)
        if html is None:
            print(f"page {page}: status={status}, stopping", file=sys.stderr)
            break
        page_ids = set(int(x) for x in FILM_RE.findall(html))
        if not page_ids:
            print(f"page {page}: no film ids, stopping", file=sys.stderr)
            break
        if prev_page_ids is not None and page_ids == prev_page_ids:
            print(f"page {page}: same ids as previous page, stopping", file=sys.stderr)
            break
        prev_page_ids = page_ids

        slug_map = {int(i): s for i, s in SLUG_RE.findall(html)}
        added_new = 0
        for film_id in page_ids:
            if film_id in seen:
                continue
            slug = slug_map.get(film_id, "")
            seen[film_id] = slug
            if film_id not in skip:
                added_new += 1
        new_count = sum(1 for fid in seen if fid not in skip)
        print(f"page {page}: {len(page_ids)} on page, "
              f"+{added_new} new (cum new={new_count}, cum total={len(seen)})",
              file=sys.stderr)

        if new_count >= args.target:
            print(f"reached target {args.target}", file=sys.stderr)
            break

        time.sleep(args.delay)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with args.out.open("w") as fh:
        for film_id in sorted(seen):
            if film_id in skip:
                continue
            slug = seen[film_id]
            if slug:
                fh.write(f"https://bestsimilar.com/movies/{film_id}-{slug}\n")
            else:
                fh.write(f"https://bestsimilar.com/movies/{film_id}\n")
            written += 1

    print(f"\nwrote {written} new URLs to {args.out} "
          f"(seen total: {len(seen)}, skipped existing: {len(seen) - written})",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
