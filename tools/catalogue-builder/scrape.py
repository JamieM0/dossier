"""Scrape film records from BestSimilar.

One JSON file per film is written to the output directory. Filename is
`{id}-{slug}.json` where id+slug come from the source URL
(`/movies/{id}-{slug}`). Existing files are skipped so the scraper is
resumable across runs and crashes.

A small worker pool fetches several films in parallel; each worker
sleeps `--delay` seconds (jittered) between its own requests, so total
load on BestSimilar scales with worker count but stays well under what
a logged-in user would generate.

Usage:
    python scrape.py --urls sample-urls.txt --out data/sample/
    python scrape.py --urls data/film-urls.txt --out data/films/ \\
        --delay 1.0 --workers 6
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
from typing import Any

from scrapling.fetchers import Fetcher


URL_RE = re.compile(r"^/?movies/(\d+)-([a-z0-9\-]+)/?$")
ABS_URL_RE = re.compile(r"https?://bestsimilar\.com(/movies/\d+-[a-z0-9\-]+)/?$")
NAME_YEAR_RE = re.compile(r"^(.*?)\s*\((\d{4})\)\s*$")


def parse_film_url(url: str) -> tuple[int, str] | None:
    """Return (id, slug) from a BestSimilar film URL, or None if unrecognised."""
    m = ABS_URL_RE.match(url.strip())
    path = m.group(1) if m else url.strip()
    m = URL_RE.match(path)
    if not m:
        return None
    return int(m.group(1)), m.group(2)


def _clean(s: str | None) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def _split_csv(s: str) -> list[str]:
    """Split a comma-separated value, drop trailing ellipses ("..."), trim."""
    parts = [p.strip().rstrip(".") for p in s.split(",")]
    return [p for p in (x.strip() for x in parts) if p]


def _extract_attrs(card) -> dict[str, str]:
    """Pull every `.attr` row from a film card as {label_lowercase: value_text}."""
    out: dict[str, str] = {}
    for attr in card.css(".attr"):
        entry = _clean(attr.css(".entry::text").get())
        value = _clean(" ".join(attr.css(".value ::text").getall())
                       or attr.css(".value::text").get() or "")
        if not entry:
            continue
        key = entry.rstrip(":").strip().lower()
        out[key] = value
    return out


def _extract_tag_groups_text(card) -> dict[str, list[str]]:
    """The film card shows a truncated preview ('a, b, c ...') per tag group,
    each row labelled (Style / Plot / Place / Time / Audience / Mood).

    Anchors aren't rendered here (the full taggable list lives in #best-tags
    further down the page). The preview text is the only signal of which
    type each tag is, so we capture it keyed by label.
    """
    out: dict[str, list[str]] = {}
    for attr in card.css(".attr.attr-tag"):
        entry = _clean(attr.css(".entry::text").get())
        if not entry:
            continue
        label = entry.rstrip(":").strip().lower()
        text = _clean(" ".join(attr.css(".value ::text").getall())
                      or attr.css(".value::text").get() or "")
        text = text.rstrip(".").rstrip()
        out[label] = _split_csv(text)
    return out


def _extract_similar(page) -> list[dict[str, Any]]:
    """Films from the "Most similar movies" list (#movie-rel-list).

    BestSimilar orders these by its own similarity score (most similar first).
    We preserve order in the output list — `rank` is the array index. Each
    entry carries the BestSimilar film id, slug, displayed title, and year if
    parseable.
    """
    out: list[dict[str, Any]] = []
    seen: set[int] = set()
    for rank, item in enumerate(page.css("#movie-rel-list .item-movie")):
        film_id_attr = item.attrib.get("data-id")
        anchors = item.css(".name-c a.name")
        a = anchors[0] if anchors else None
        if a is None:
            continue
        href = a.attrib.get("href", "")
        m = re.match(r"^/movies/(\d+)-(.+)$", href)
        if not m:
            continue
        film_id = int(m.group(1))
        if film_id in seen:
            continue
        seen.add(film_id)
        name_year = _clean(a.text)
        ny = NAME_YEAR_RE.match(name_year)
        title = ny.group(1).strip() if ny else name_year
        year = int(ny.group(2)) if ny else None
        out.append({
            "id": film_id,
            "slug": m.group(2),
            "title": title,
            "year": year,
            "rank": rank,
        })
    return out


def _extract_flat_tags(page) -> list[dict[str, Any]]:
    """Flat list of every tag the film carries, from the #best-tags grid.

    Each item is {id, slug, name, film_count}. The film_count is BestSimilar's
    own count of films sharing the tag — useful as a specificity signal when
    deriving feature weights (rare tags carry more information than common ones).
    """
    out: list[dict[str, Any]] = []
    seen: set[int] = set()
    selector = (
        "#best-tags .block-ins-item, "
        "#after-movie-rel-list-tag-block .block-ins-item"
    )
    for item in page.css(selector):
        a = item.css_first(".block-ins-caption a") if hasattr(item, "css_first") else None
        if a is None:
            anchors = item.css(".block-ins-caption a")
            a = anchors[0] if anchors else None
        if a is None:
            continue
        href = a.attrib.get("href", "")
        m = re.match(r"^/tag/(\d+)-(.+)$", href)
        if not m:
            continue
        tag_id = int(m.group(1))
        if tag_id in seen:
            continue
        seen.add(tag_id)
        num_text = _clean(" ".join(item.css(".block-ins-num::text").getall()))
        num_match = re.search(r"(\d[\d,]*)", num_text)
        film_count = int(num_match.group(1).replace(",", "")) if num_match else None
        out.append({
            "id": tag_id,
            "slug": m.group(2),
            "name": _clean(a.text),
            "film_count": film_count,
        })
    return out


def _extract_genres(attrs: dict[str, str]) -> list[str]:
    return _split_csv(attrs.get("genre", ""))


def _parse_rating(card) -> float | None:
    text = _clean(card.css_first(".rat-rating::text").text if hasattr(card, 'css_first') else None) \
        if False else _clean(" ".join(card.css(".rat-rating::text").getall()))
    if not text:
        return None
    m = re.search(r"([\d.]+)", text)
    return float(m.group(1)) if m else None


def _parse_votes(card) -> str:
    text = _clean(" ".join(card.css(".rat-vote::text").getall()))
    return text or ""


def _parse_duration(value: str) -> int | None:
    m = re.search(r"(\d+)\s*min", value, re.I)
    return int(m.group(1)) if m else None


def scrape_film(url: str, *, retries: int = 2) -> dict[str, Any]:
    parsed = parse_film_url(url)
    if not parsed:
        raise ValueError(f"Not a BestSimilar film URL: {url!r}")
    film_id, slug = parsed
    full_url = f"https://bestsimilar.com/movies/{film_id}-{slug}"

    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            page = Fetcher.get(full_url)
            if page.status != 200:
                raise RuntimeError(f"HTTP {page.status} for {full_url}")
            break
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt == retries:
                raise
            time.sleep(2 ** attempt)
    else:  # pragma: no cover
        raise last_exc  # type: ignore[misc]

    # The primary film is the first .item.item-big.item-movie on the page.
    card = page.css_first(f".item-movie[data-id='{film_id}']") \
        if hasattr(page, "css_first") else None
    if card is None:
        cards = page.css(f".item-movie[data-id='{film_id}']")
        card = cards[0] if cards else None
    if card is None:
        cards = page.css(".item.item-big.item-movie")
        card = cards[0] if cards else None
    if card is None:
        raise RuntimeError(f"No film card found on {full_url}")

    name_year = _clean(card.css(".name-c span::text").get())
    m = NAME_YEAR_RE.match(name_year)
    title = m.group(1).strip() if m else name_year
    year = int(m.group(2)) if m else None

    attrs = _extract_attrs(card)
    poster = card.css(".img-c img::attr(src)").get()
    if poster and poster.startswith("/"):
        poster = "https://bestsimilar.com" + poster

    record = {
        "source": "bestsimilar",
        "source_url": full_url,
        "id": film_id,
        "slug": slug,
        "title": title,
        "year": year,
        "rating": _parse_rating(card),
        "votes_text": _parse_votes(card),
        "poster_url": poster,
        "genres": _extract_genres(attrs),
        "country": _split_csv(attrs.get("country", "")),
        "duration_min": _parse_duration(attrs.get("duration", "")),
        "story": attrs.get("story", ""),
        "tags": _extract_flat_tags(page),
        "tag_groups_text": _extract_tag_groups_text(card),
        "similar": _extract_similar(page),
        "scraped_at": int(time.time()),
    }
    return record


_counters_lock = threading.Lock()


def _scrape_one(raw: str, out_dir: Path, delay: float) -> tuple[str, str | None]:
    """Worker: scrape a single URL, return (status, message).

    status is 'ok' | 'skip' | 'fail'. Called from worker threads.
    """
    parsed = parse_film_url(raw)
    if not parsed:
        return ("skip", f"not a film url: {raw}")
    film_id, slug = parsed
    out_path = out_dir / f"{film_id}-{slug}.json"
    if out_path.exists():
        return ("skip", out_path.name)
    try:
        record = scrape_film(raw)
    except Exception as exc:  # noqa: BLE001
        return ("fail", f"{raw}: {exc}")
    out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))
    # Per-worker pacing so the aggregate rate stays moderate even with
    # several workers.
    time.sleep(delay * random.uniform(0.5, 1.5))
    return ("ok", f"{out_path.name}  ({record.get('title')!r}, {record.get('year')})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", required=True, type=Path,
                    help="Text file of BestSimilar film URLs, one per line")
    ap.add_argument("--out", required=True, type=Path,
                    help="Output directory; one {id}-{slug}.json per film")
    ap.add_argument("--delay", type=float, default=1.0,
                    help="Per-worker seconds between requests (jittered ±50%%)")
    ap.add_argument("--limit", type=int, default=0,
                    help="Stop after N films are written (0 = no limit)")
    ap.add_argument("--workers", type=int, default=4,
                    help="Concurrent fetchers")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    urls = [ln.strip() for ln in args.urls.read_text().splitlines()
            if ln.strip() and not ln.startswith("#")]

    processed = 0
    skipped = 0
    failed = 0
    stop = threading.Event()

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(_scrape_one, u, args.out, args.delay): u for u in urls}
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
                    # Cancel remaining tasks (those already running will finish).
                    for f in futures:
                        if not f.done():
                            f.cancel()
                    break
        except KeyboardInterrupt:
            for f in futures:
                f.cancel()
            print("\ninterrupted", file=sys.stderr)

    print(f"\ndone. wrote={processed} skipped(exists)={skipped} failed={failed}",
          file=sys.stderr)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
