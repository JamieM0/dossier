"""Convert raw scraped films into the bundled runtime catalogue.

For each `data/films/{id}-{slug}.json`, derive a feature vector via
`feature_schema.feature_vector`, project away source-only fields (full
tag dumps, scraping metadata), and write one
`apps/dossier-ui/static/catalogue/films/{id}.json` per film.

Also writes `index.json` — a small all-films manifest the runtime loads
once on boot for the rating queue and recommendations engine, so the
app does not have to scan a directory of N thousand files at startup.

Popularity is estimated from BestSimilar's vote-count string ("2.8M",
"540K", "12k"). It is used as the serving-order signal in the rating
queue (recognisable films first).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from feature_schema import AXES, feature_vector


VOTES_RE = re.compile(r"([\d.]+)\s*([kKmM]?)")


def parse_votes(s: str | None) -> int:
    if not s:
        return 0
    m = VOTES_RE.search(s)
    if not m:
        return 0
    n = float(m.group(1))
    suffix = m.group(2).lower()
    mult = {"k": 1_000, "m": 1_000_000}.get(suffix, 1)
    return int(n * mult)


def convert_one(raw: dict) -> dict:
    features = feature_vector(raw)
    # Keep only the top-N anchored tags for display ('themes' chip row in UI).
    tags = [t.get("name") for t in (raw.get("tags") or [])
            if isinstance(t, dict) and t.get("name")][:12]
    return {
        "id": raw["id"],
        "slug": raw.get("slug", ""),
        "title": raw.get("title", ""),
        "year": raw.get("year"),
        "rating": raw.get("rating"),
        "popularity": parse_votes(raw.get("votes_text")),
        "duration_min": raw.get("duration_min"),
        "poster_url": raw.get("poster_url"),
        "genres": raw.get("genres") or [],
        "country": raw.get("country") or [],
        "story": raw.get("story") or "",
        "themes": tags,
        "features": features,
        "similar_ids": [s["id"] for s in (raw.get("similar") or [])
                        if isinstance(s, dict) and "id" in s],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_dir", required=True, type=Path,
                    help="Directory of raw scraped JSON files")
    ap.add_argument("--out", required=True, type=Path,
                    help="Directory to write per-film converted JSON")
    ap.add_argument("--index", required=True, type=Path,
                    help="Path to write the lightweight catalogue index.json")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    args.index.parent.mkdir(parents=True, exist_ok=True)

    index: list[dict] = []
    converted = 0
    skipped = 0

    for src in sorted(args.in_dir.glob("*.json")):
        try:
            raw = json.loads(src.read_text())
        except Exception as exc:  # noqa: BLE001
            print(f"skip {src.name}: parse error: {exc}", file=sys.stderr)
            skipped += 1
            continue
        if not raw.get("id") or not raw.get("title"):
            skipped += 1
            continue
        record = convert_one(raw)
        out_path = args.out / f"{record['id']}.json"
        out_path.write_text(json.dumps(record, ensure_ascii=False))
        # Index entry: just what the rating queue / list views need.
        index.append({
            "id": record["id"],
            "title": record["title"],
            "year": record["year"],
            "popularity": record["popularity"],
            "rating": record["rating"],
            "poster_url": record["poster_url"],
            "genres": record["genres"],
            "features": record["features"],
        })
        converted += 1

    # Sort index by popularity descending so the rating queue can slice
    # from the top without re-sorting on every load.
    index.sort(key=lambda r: r["popularity"] or 0, reverse=True)
    args.index.write_text(json.dumps({
        "version": 1,
        "axes": [{"key": a.key, "label": a.label,
                  "pos": a.pos_label, "neg": a.neg_label} for a in AXES],
        "films": index,
    }, ensure_ascii=False))

    print(f"converted={converted} skipped={skipped} index={args.index}",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
