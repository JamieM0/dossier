"""Backfill the `votes` integer (and refresh `votes_text`) on every
already-scraped raw film record.

Walks `data/films/*.json`, refetches each film's BestSimilar page, and
patches only the vote fields into the existing JSON in place. Every
other field (story, tags, similar, features-derivation inputs, etc.) is
left untouched, so this is safe to re-run and won't regress any data we
spent time scraping originally.

By default, skips files that already have a non-null integer `votes`
field so the script is resumable across runs. Pass `--force` to
re-extract for every file (use this once after the scraper's vote
extraction is changed, so old `votes` values get refreshed).

Usage:
    python rescrape_votes.py --in data/films/
    python rescrape_votes.py --in data/films/ --force --workers 6 --delay 1.0
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from scrapling.fetchers import Fetcher

from scrape import _clean, _parse_votes, _parse_votes_int


_counters_lock = threading.Lock()


def _fetch_card(film_id: int, slug: str):
    """Return the primary film card element for the given film, or
    raise. Mirrors scrape.scrape_film's card-locating logic so we get
    the same `.rat-vote` we'd get on a fresh scrape."""
    url = f"https://bestsimilar.com/movies/{film_id}-{slug}"
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            page = Fetcher.get(url)
            if page.status != 200:
                raise RuntimeError(f"HTTP {page.status} for {url}")
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    else:  # pragma: no cover
        raise last_exc  # type: ignore[misc]

    cards = page.css(f".item-movie[data-id='{film_id}']")
    card = cards[0] if cards else None
    if card is None:
        cards = page.css(".item.item-big.item-movie")
        card = cards[0] if cards else None
    if card is None:
        raise RuntimeError(f"No film card on {url}")
    return card


def _rescrape_one(
    path: Path,
    *,
    delay: float,
    force: bool,
) -> tuple[str, str | None]:
    """Worker: refresh votes on a single file. Returns (status, message).
    status is 'ok' | 'skip' | 'fail'."""
    try:
        record = json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        return ("fail", f"{path.name}: parse error: {exc}")

    film_id = record.get("id")
    slug = record.get("slug")
    if not isinstance(film_id, int) or not isinstance(slug, str):
        return ("fail", f"{path.name}: missing id/slug")

    existing = record.get("votes")
    if not force and isinstance(existing, int) and existing >= 0:
        return ("skip", path.name)

    try:
        card = _fetch_card(film_id, slug)
    except Exception as exc:  # noqa: BLE001
        return ("fail", f"{path.name}: {exc}")

    votes_text = _parse_votes(card)
    votes_int = _parse_votes_int(card)
    record["votes_text"] = votes_text
    record["votes"] = votes_int

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(record, indent=2, ensure_ascii=False))
    tmp.replace(path)

    time.sleep(delay * random.uniform(0.5, 1.5))
    return ("ok", f"{path.name}  votes={votes_int} ({votes_text!r})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_dir", required=True, type=Path,
                    help="Directory of raw scraped JSON files to update in place")
    ap.add_argument("--delay", type=float, default=1.0,
                    help="Per-worker seconds between requests (jittered ±50%%)")
    ap.add_argument("--workers", type=int, default=4,
                    help="Concurrent fetchers")
    ap.add_argument("--limit", type=int, default=0,
                    help="Stop after N files updated (0 = no limit)")
    ap.add_argument("--force", action="store_true",
                    help="Re-extract votes even for files that already have it")
    args = ap.parse_args()

    if not args.in_dir.is_dir():
        print(f"not a directory: {args.in_dir}", file=sys.stderr)
        return 2

    files = sorted(args.in_dir.glob("*.json"))
    if not files:
        print("no JSON files found", file=sys.stderr)
        return 0

    processed = 0
    skipped = 0
    failed = 0
    stop = threading.Event()

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {
            pool.submit(_rescrape_one, f, delay=args.delay, force=args.force): f
            for f in files
        }
        try:
            for fut in as_completed(futures):
                status, msg = fut.result()
                with _counters_lock:
                    if status == "ok":
                        processed += 1
                        print(f"ok  [{processed}]  {msg}")
                        if args.limit and processed >= args.limit:
                            stop.set()
                    elif status == "skip":
                        skipped += 1
                    else:
                        failed += 1
                        print(f"FAIL {msg}", file=sys.stderr)
                if stop.is_set():
                    for f in futures:
                        if not f.done():
                            f.cancel()
                    break
        except KeyboardInterrupt:
            for f in futures:
                f.cancel()
            print("\ninterrupted", file=sys.stderr)

    print(
        f"\ndone. updated={processed} skipped(already-has-votes)={skipped} failed={failed}",
        file=sys.stderr,
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
