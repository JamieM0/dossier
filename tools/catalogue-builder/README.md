# Catalogue Builder

Offline developer tool that scrapes [BestSimilar](https://bestsimilar.com)
and produces the bundled film catalogue shipped with Dossier.

This is **not** part of the app. Nothing here runs on the user device.

## Storage convention

**One JSON file per movie**, throughout the pipeline. No mega-JSON, no JSONL.
This keeps diffs reviewable, lets the scraper resume by checking which
files already exist, and lets the converter operate on records
independently.

- Raw scraped records: `data/films/{id}-{slug}.json`
- Converted app-side records: `apps/dossier-ui/static/catalogue/films/{id}.json`
- Index of all film IDs (small file, used for app-side discovery):
  `apps/dossier-ui/static/catalogue/index.json`

## Pipeline

1. `discover.py` — walk BestSimilar index pages (`/movies?page=N`,
   `/top/best-*-movies`, `/top/best-movies-of-YEAR`) to collect a deduped
   set of film URLs and write them to `data/film-urls.txt`.
2. `scrape.py` — fetch each film page, parse the main item card, and
   write one JSON file per film to `data/films/`. Resumable: skips URLs
   whose target file already exists.
3. `convert.py` — fold scraped records into the app-side feature schema
   (10–15 medium-agnostic dimensions). Writes one JSON per film to
   `apps/dossier-ui/static/catalogue/films/` plus `index.json`.

## Setup

```bash
pip install "scrapling[fetchers]"
scrapling install   # one-time, fetches browser binaries
```

## Sample run (for confirmation)

```bash
python scrape.py --urls sample-urls.txt --out data/sample/
```

The sample URLs file is committed.
