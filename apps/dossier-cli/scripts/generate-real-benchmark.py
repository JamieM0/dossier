#!/usr/bin/env python3
"""Freeze a real-film, real-viewer evaluation cohort from MovieLens and the bundled catalogue."""
import argparse
import csv
import hashlib
import io
import json
import re
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CATALOGUE = ROOT / "apps/dossier-ui/static/catalogue/films"
OUTPUT = ROOT / "apps/dossier-cli/src/lab/real-v1.json"
SOURCE_URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
SOURCE_SHA256 = "696d65a3dfceac7c45750ad32df2c259311949efec81f0f144fdfb91ebc9e436"
SEED = 20260928


def normalized_title(title):
    moved = re.match(r"^(.*), (The|A|An)$", title, re.I)
    if moved:
        title = f"{moved.group(2)} {moved.group(1)}"
    plain = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", plain)


def stable_order(user_id, movie_id, context):
    value = f"{SEED}:{context}:{user_id}:{movie_id}".encode()
    return hashlib.sha256(value).hexdigest()


def rating_value(stars):
    """Use only unambiguous likes and dislikes in the ranking score."""
    return {0.5: -3, 1.0: -3, 1.5: -2, 2.0: -2, 2.5: -1,
            3.0: 0, 3.5: 0, 4.0: 2, 4.5: 3, 5.0: 3}[stars]


def csv_in_zip(archive, name):
    return csv.DictReader(io.StringIO(archive.read(f"ml-latest-small/{name}").decode("utf-8")))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--movielens-zip", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    source = args.movielens_zip.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise SystemExit("MovieLens archive checksum differs; do not silently change real-v1")

    catalogue = defaultdict(list)
    for path in sorted(CATALOGUE.glob("*.json")):
        film = json.loads(path.read_text())
        catalogue[(normalized_title(film["title"]), film["year"])].append(film)

    with zipfile.ZipFile(io.BytesIO(source)) as archive:
        movie_to_film = {}
        for movie in csv_in_zip(archive, "movies.csv"):
            title = re.match(r"^(.*) \((\d{4})\)$", movie["title"])
            if not title:
                continue
            matches = catalogue[(normalized_title(title.group(1)), int(title.group(2)))]
            if len(matches) == 1:
                movie_to_film[int(movie["movieId"])] = matches[0]

        reverse_matches = defaultdict(list)
        for movie_id, film in movie_to_film.items():
            reverse_matches[film["id"]].append(movie_id)
        movie_to_film = {movie_id: film for movie_id, film in movie_to_film.items()
                         if len(reverse_matches[film["id"]]) == 1}

        viewer_rows = defaultdict(list)
        movie_stars = defaultdict(list)
        for row in csv_in_zip(archive, "ratings.csv"):
            movie_id = int(row["movieId"])
            if movie_id in movie_to_film:
                movie_stars[movie_id].append(float(row["rating"]))
                viewer_rows[int(row["userId"])].append({
                    "movieLensId": movie_id,
                    "filmKey": f"movie:{movie_to_film[movie_id]['id']}",
                    "stars": float(row["rating"]),
                    "rating": rating_value(float(row["rating"])),
                    "timestamp": int(row["timestamp"]),
                })

    viewers = []
    for user_id in sorted(viewer_rows):
        rows = viewer_rows[user_id]
        likes = [row for row in rows if row["rating"] > 0]
        dislikes = [row for row in rows if row["rating"] < 0]
        if len(rows) < 150 or len(likes) < 40 or len(dislikes) < 40:
            continue
        ordered = sorted(rows, key=lambda row: stable_order(user_id, row["movieLensId"], "holdout"))
        positive = [row for row in ordered if row["rating"] > 0][:12]
        negative = [row for row in ordered if row["rating"] < 0][:12]
        reserved = {row["filmKey"] for row in positive + negative}
        held_out = positive + negative + [row for row in ordered if row["filmKey"] not in reserved][:36]
        held_out = [{**row, "otherViewerMean": round(
            (sum(movie_stars[row["movieLensId"]]) - row["stars"] + 35) /
            (len(movie_stars[row["movieLensId"]]) - 1 + 10), 6)} for row in held_out]
        held_keys = {row["filmKey"] for row in held_out}
        training = [row for row in rows if row["filmKey"] not in held_keys]
        if len(held_keys) != 60 or len(training) < 40:
            raise SystemExit(f"Invalid split for viewer {user_id}")
        viewers.append({
            "id": f"movielens-{user_id}",
            "sourceUserId": user_id,
            "trainingRatings": sorted(training, key=lambda row: row["movieLensId"]),
            "heldOutRatings": sorted(held_out, key=lambda row: row["movieLensId"]),
        })

    selected_keys = {row["filmKey"] for viewer in viewers
                     for row in viewer["trainingRatings"] + viewer["heldOutRatings"]}
    films_by_key = {f"movie:{film['id']}": film for matches in catalogue.values() for film in matches}
    items = []
    for key in sorted(selected_keys, key=lambda value: int(value.split(":")[1])):
        film = films_by_key[key]
        items.append({
            "id": film["id"], "medium": "movie", "title": film["title"],
            "year": film["year"], "voteAverage": film["rating"],
            "voteCount": None, "popularity": film["popularity"],
            "genreIds": [], "genres": list(dict.fromkeys(
                {"Sci-Fi": "Science Fiction", "Musical": "Music"}.get(genre, genre)
                for genre in film["genres"])), "posterPath": None,
            "overview": film["story"], "runtime": film["duration_min"],
            "keywords": film["themes"], "collection": None,
            "directorIds": [], "creatorIds": [],
            "source": {"catalogueId": film["id"], "movieLensIds": sorted({row["movieLensId"] for viewer in viewers for row in viewer["trainingRatings"] + viewer["heldOutRatings"] if row["filmKey"] == key})},
        })

    fixture = {
        "version": "real-v1", "seed": SEED,
        "sources": {
            "ratings": {"name": "MovieLens ml-latest-small, 2018 snapshot", "url": SOURCE_URL,
                        "sha256": SOURCE_SHA256, "readme": "https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html"},
            "filmMetadata": "Dossier's bundled BestSimilar film catalogue, matched by normalized title and exact release year",
            "licenseNote": "MovieLens permits research use and redistribution under its stated conditions. Acknowledge GroupLens; do not imply endorsement. Commercial use requires its permission.",
        },
        "selection": {
            "matchedFilms": len(movie_to_film),
            "viewerRule": "At least 150 matched ratings, 40 clear likes (4+ stars), and 40 clear dislikes (2.5 stars or less). Include every qualifying viewer.",
            "heldOutRule": "60 rated films per viewer: reserve 12 clear likes and 12 clear dislikes, then take 36 more by fixed hash order.",
            "ratingRule": "0.5/1=-3, 1.5/2=-2, 2.5=-1, 3/3.5=0, 4=+2, 4.5/5=+3.",
            "otherViewerMean": "A simple reference score from other MovieLens viewers. It subtracts this viewer's rating and shrinks sparse films toward 3.5 stars with ten prior ratings. Dossier does not get these scores.",
            "genreTranslation": "Translate Sci-Fi to Science Fiction and Musical to Music for Dossier's genre vocabulary. Preserve all other source labels.",
            "caveat": "The evaluation can score only films a viewer chose to rate. These rated films are not a random sample of all films. Film metadata lacks director and series fields.",
        },
        "items": items, "viewers": viewers,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"{args.output}: {len(viewers)} real viewers, {len(items)} real films, 60 held-out ratings each")


if __name__ == "__main__":
    main()
