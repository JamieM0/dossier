"""Discover new BestSimilar film URLs by walking the `similar` arrays of
films we've already scraped.

Each scraped film carries up to 30 entries under `similar`, each with an
id+slug. Films we already have on disk are obviously skipped; everything
else becomes a candidate URL for the next scrape pass.

Writes a deduped URL list to the path given by --out, sorted by how often
each candidate id appears across the corpus (most-referenced first), so
when you cap with --limit you keep the most "centrally connected" films.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--films-dir", type=Path,
                    default=Path("data/films"),
                    help="Directory of already-scraped {id}-{slug}.json files")
    ap.add_argument("--out", required=True, type=Path,
                    help="Output URL list (one per line)")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap at N candidates (0 = all). Highest-frequency first.")
    args = ap.parse_args()

    if not args.films_dir.is_dir():
        print(f"no such dir: {args.films_dir}", file=sys.stderr)
        return 2

    have_ids: set[int] = set()
    slug_for: dict[int, str] = {}
    freq: Counter[int] = Counter()

    files = sorted(args.films_dir.glob("*.json"))
    print(f"loading {len(files)} existing films...", file=sys.stderr)
    for p in files:
        try:
            rec = json.loads(p.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"  skip unreadable {p.name}: {exc}", file=sys.stderr)
            continue
        rid = rec.get("id")
        if isinstance(rid, int):
            have_ids.add(rid)
        for s in rec.get("similar") or []:
            sid = s.get("id")
            slug = s.get("slug") or ""
            if not isinstance(sid, int):
                continue
            freq[sid] += 1
            if sid not in slug_for or (not slug_for[sid] and slug):
                slug_for[sid] = slug

    candidates = [(sid, n) for sid, n in freq.items() if sid not in have_ids]
    candidates.sort(key=lambda t: (-t[1], t[0]))
    if args.limit:
        candidates = candidates[: args.limit]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as fh:
        for sid, _ in candidates:
            slug = slug_for.get(sid, "")
            if slug:
                fh.write(f"https://bestsimilar.com/movies/{sid}-{slug}\n")
            else:
                fh.write(f"https://bestsimilar.com/movies/{sid}\n")

    print(f"have {len(have_ids)} films on disk", file=sys.stderr)
    print(f"found {len(freq)} unique referenced ids; "
          f"{len(freq) - sum(1 for sid in freq if sid in have_ids)} are new",
          file=sys.stderr)
    print(f"wrote {len(candidates)} candidate urls to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
