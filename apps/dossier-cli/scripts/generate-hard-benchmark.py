#!/usr/bin/env python3
"""Generate the frozen hard-v1 fixture. Run only when intentionally versioning the benchmark."""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/lab/hard-v1.json"
RNG = random.Random(20260928)

# Public metadata resembles title metadata that the real CLI can receive.
FAMILIES = [
    ('Philosophical signal', 'Science Fiction', ['philosophical', 'quiet']),
    ('Space spectacle', 'Science Fiction', ['action', 'spectacle']),
    ('Intimate future', 'Science Fiction', ['romance', 'quiet']),
    ('Haunted house', 'Horror', ['atmospheric', 'no-gore']),
    ('Slasher', 'Horror', ['gore', 'violent']),
    ('Wry comedy', 'Comedy', ['witty', 'character']),
    ('Broad comedy', 'Comedy', ['broad', 'silly']),
    ('Domestic drama', 'Drama', ['intimate', 'quiet']),
    ('Historical epic', 'Drama', ['epic', 'historical']),
    ('Puzzle thriller', 'Thriller', ['puzzle', 'nolan']),
    ('Opaque puzzle', 'Thriller', ['puzzle', 'nolan', 'tenet-like']),
    ('Crime noir', 'Crime', ['noir', 'ambiguous']),
    ('Animated wonder', 'Animation', ['family', 'warm']),
    ('Fantasy quest', 'Fantasy', ['adventure', 'epic']),
    ('Nature study', 'Documentary', ['quiet', 'nature']),
    ('Music portrait', 'Documentary', ['music', 'intimate']),
    ('Quiet ghost', 'Horror', ['atmospheric', 'ambiguous']),
    ('Comic heist', 'Crime', ['witty', 'heist']),
    ('Tender mystery', 'Mystery', ['intimate', 'mystery']),
    ('Military future', 'Science Fiction', ['action', 'war']),
    ('Family adventure', 'Adventure', ['family', 'adventure']),
    ('Art documentary', 'Documentary', ['art', 'experimental']),
    ('Courtroom portrait', 'Drama', ['moral', 'character']),
    ('Absurd fantasy', 'Fantasy', ['silly', 'experimental']),
]

items = []
latent = {}
for family_index, (name, genre, tags) in enumerate(FAMILIES):
    for variant in range(12):
        item_id = 910000 + family_index * 100 + variant + 1
        item_key = f"movie:{item_id}"
        franchise = 8000 + family_index // 4 if variant < 8 else None
        director = 6000 + variant % 4
        year = 1980 + (family_index * 11 + variant * 7) % 45
        popularity = round(15 + RNG.random() * 180, 3)
        vote_average = round(5.2 + RNG.random() * 3.7, 3)
        public_tags = list(tags)
        if variant % 4 == 0: public_tags.append("slow")
        if variant % 5 == 0: public_tags.append("experimental")
        items.append({
            "id": item_id, "medium": "movie", "title": f"{name} {variant + 1}", "year": year,
            "voteAverage": vote_average, "voteCount": 80 + variant * 39,
            "popularity": popularity, "genreIds": [], "genres": [genre], "posterPath": None,
            "overview": f"A fictional {genre.lower()} title.", "runtime": 82 + variant * 7,
            "keywords": public_tags,
            "collection": {"id": franchise, "name": f"Cycle {franchise}", "posterPath": None, "backdropPath": None} if franchise else None,
            "directorIds": [director], "creatorIds": []
        })
        latent[item_key] = {
            "family": family_index, "variant": variant, "sincere": (variant + family_index) % 3 != 0,
            "bleakEnding": (variant * 2 + family_index) % 5 < 2,
            "gore": 2 if family_index == 4 else (1 if family_index in (3, 16) and variant % 3 == 0 else 0),
            "craft": (variant * 5 + family_index * 3) % 11,
            "franchise": franchise, "director": director
        }

def utility(profile, item, hidden):
    f, v = hidden["family"], hidden["variant"]
    value = -.5
    if profile == "split_extremes": value = 3 if f in (0, 1) else -1.2
    elif profile == "horror_exceptions": value = 3 if f in (3,16) and (hidden["gore"] == 0 or hidden["sincere"]) else (-2 if item["genres"][0] == "Horror" else -.5)
    elif profile == "franchise_loyal": value = 2.8 if hidden["franchise"] == 8001 else -1.2
    elif profile == "director_loyal": value = 2.8 if hidden["director"] == 6001 else -.9
    elif profile == "distant_favourites": value = 2.5 if f in (0, 6, 14, 17, 22) else -1.1
    elif profile == "near_neighbour": value = (3 if hidden["sincere"] else -2) if f in (0,2,18) else -1.1
    elif profile == "broad_taste": value = 1.5 if hidden["gore"] == 0 else -1.8
    elif profile == "selective": value = 3.2 if hidden["craft"] >= 9 and hidden["sincere"] else -1.6
    elif profile == "noisy_rater": value = 2 if f in (0,3,7,18,21) else -1.2
    elif profile == "misleading_start": value = 2.7 if f in (0,2) else (-2 if item["genres"][0] == "Science Fiction" else -.7)
    elif profile == "claim_narrowing": value = 2.6 if item["genres"][0] == "Science Fiction" and "quiet" in item["keywords"] else (-2 if item["genres"][0] == "Science Fiction" else -.5)
    elif profile == "franchise_exception": value = (3 if v % 3 != 0 else -2) if hidden["franchise"] == 8003 else -.9
    elif profile == "director_exception": value = (3 if hidden["gore"] == 0 and not hidden["bleakEnding"] else -2) if hidden["director"] == 6000 else -.8
    elif profile == "ending_sensitive": value = (2 if not hidden["bleakEnding"] else -2) if f in (2,7,18,22) else -.8
    elif profile == "era_preference": value = 2 if item["year"] <= 1998 else -1.5
    elif profile == "dry_comedy": value = 3 if f == 5 or (f == 17 and hidden["sincere"]) else (-2 if item["genres"][0] == "Comedy" else -.6)
    elif profile == "opposite_clusters": value = 2.8 if f in (3,6,11,20) else -1.1
    elif profile == "craft_over_genre": value = 2.5 if hidden["craft"] >= 8 else -1.2
    else: raise ValueError(profile)
    # Stable idiosyncrasy that does not use Dossier's feature vector.
    value += (((f * 29 + v * 17 + len(profile) * 7) % 13) - 6) * .055
    return value

PROFILE_DESCRIPTIONS = {
    "split_extremes": "Loves both quiet philosophical science fiction and loud space spectacles, with little interest between them.",
    "horror_exceptions": "Dislikes horror in general but loves sincere, low-gore haunted stories.",
    "franchise_loyal": "Follows one anthology franchise across different genres.",
    "director_loyal": "Likes one director across otherwise unrelated films.",
    "distant_favourites": "Favourites span distant genres and feature vectors.",
    "near_neighbour": "Likes sincere titles but rejects very similar insincere titles.",
    "broad_taste": "Likes most titles but strongly dislikes gore.",
    "selective": "Likes only rare, carefully made titles.",
    "noisy_rater": "Has stable preferences but gives some inconsistent ratings.",
    "misleading_start": "Early science fiction likes mask a narrower preference.",
    "claim_narrowing": "Likes quiet science fiction and rejects action-driven science fiction.",
    "franchise_exception": "Likes a franchise except its bleak-ending entries.",
    "director_exception": "Likes one director except their gory or bleak films.",
    "ending_sensitive": "An ending determines taste within several similar families.",
    "era_preference": "Prefers older titles across genres.",
    "dry_comedy": "Dislikes comedy except sincere, dry character pieces.",
    "opposite_clusters": "Likes both eerie horror and broad comedy or adventure.",
    "craft_over_genre": "Craft matters more than genre or style."
}

def rating(value):
    if value >= 2.5: return 3
    if value >= 1.25: return 2
    if value >= .25: return 1
    if value <= -2.5: return -3
    if value <= -1.25: return -2
    if value <= -.25: return -1
    return 0

personas = []
for profile, description in PROFILE_DESCRIPTIONS.items():
    ratings = {f"movie:{item['id']}": rating(utility(profile, item, latent[f"movie:{item['id']}"])) for item in items}
    personas.append({"id": profile, "description": description, "ratings": ratings,
                     "noiseModulo": 11 if profile == "noisy_rater" else None})

def is_holdout(item):
    family = (item["id"] - 910001) // 100
    variant = (item["id"] - 910001) % 100
    return (family * 5 + variant * 7) % 4 == 0

training_keys = [f"movie:{item['id']}" for item in items if not is_holdout(item)]
holdout_keys = [f"movie:{item['id']}" for item in items if is_holdout(item)]
fixture = {
    "version": "hard-v1", "seed": 20260928,
    "items": items, "trainingKeys": training_keys, "holdoutKeys": holdout_keys,
    "latent": latent, "personas": personas,
    "notes": "Only items and revealed training ratings cross the CLI action boundary. Latent attributes and full ratings stay in the evaluator."
}
OUTPUT.write_text(json.dumps(fixture, separators=(",", ":"), ensure_ascii=False) + "\n")
print(f"{OUTPUT}: {len(items)} items, {len(personas)} personas, {len(holdout_keys)} held out")
