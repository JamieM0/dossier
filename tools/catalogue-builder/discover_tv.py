"""Discover TV-show URLs from BestSimilar's /tv index pages.

Walks pages 1..N of https://bestsimilar.com/tv and collects every linked
show URL (BestSimilar uses the /movies/{id}-{slug} URL space for shows as
well as films, so the scraper itself is identical — only the listing
source differs).

Writes a deduped URL list. Feed it to scrape.py with `--out tv/` to
produce per-show JSON records in tools/catalogue-builder/tv/.
"""
from __future__ import annotations

import argparse
import random
import re
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher


SLUG_RE = re.compile(r'href="/movies/(\d+)-([a-z0-9\-]+)"')


def fetch_page(url: str, retries: int = 2) -> str | None:
    for attempt in range(retries + 1):
        try:
            r = Fetcher.get(url)
            if r.status == 200:
                return r.body.decode("utf-8", "replace") if isinstance(r.body, bytes) else r.body
            if r.status in (301, 302, 404):
                return None
        except Exception:  # noqa: BLE001
            pass
        if attempt < retries:
            time.sleep(2 ** attempt)
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path,
                    help="Output URL list (one per line)")
    ap.add_argument("--max-pages", type=int, default=10,
                    help="Walk /tv?page=1.. up to this page inclusive")
    ap.add_argument("--delay", type=float, default=0.8)
    args = ap.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seen: dict[int, str] = {}
    base = "https://bestsimilar.com/tv"
    prev_ids: set[int] | None = None

    for page in range(1, args.max_pages + 1):
        url = base if page == 1 else f"{base}?page={page}"
        print(f"[page {page}] {url}", file=sys.stderr)
        html = fetch_page(url)
        if html is None:
            print(f"  no content, stopping", file=sys.stderr)
            break
        pairs = SLUG_RE.findall(html)
        page_ids = {int(i) for i, _ in pairs}
        if not page_ids:
            print(f"  no shows on page, stopping", file=sys.stderr)
            break
        if prev_ids is not None and page_ids == prev_ids:
            # bestsimilar silently redirects past-end pagination to page 1
            print(f"  same as previous page, stopping", file=sys.stderr)
            break
        prev_ids = page_ids
        before = len(seen)
        for show_id, slug in pairs:
            sid = int(show_id)
            if sid not in seen or (not seen[sid] and slug):
                seen[sid] = slug
        print(f"  +{len(seen) - before} (cum {len(seen)})", file=sys.stderr)
        # Persist after every page so a crash keeps progress.
        with args.out.open("w") as fh:
            for sid in sorted(seen):
                slug = seen[sid]
                fh.write(f"https://bestsimilar.com/movies/{sid}-{slug}\n"
                         if slug else f"https://bestsimilar.com/movies/{sid}\n")
        if page < args.max_pages:
            time.sleep(args.delay * random.uniform(0.5, 1.5))

    print(f"\ndone. {len(seen)} unique shows written to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
