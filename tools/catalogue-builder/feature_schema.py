"""Feature schema for the bundled catalogue.

12 medium-agnostic dimensions, each in [-1, 1]. A film's value on each
axis is computed deterministically from its BestSimilar tags (style /
plot / mood / etc.) using the keyword maps below. The same schema will
apply to books in phase 3 without modification.

Each axis lists keywords whose presence pushes the value toward +1, and
keywords that push it toward -1. The score is `sum(matches) / max(N, 1)`
clipped to [-1, 1] where N is a small denominator (LOOSE_DENOM) so a
single signal does not max the axis.

Tag matching is case-insensitive substring over the flat tag list plus
every value in `tag_groups_text`. We deliberately accept noise: low
recall on any one tag is fine because films carry many tags.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Axis:
    key: str
    label: str          # human-readable axis name
    pos_label: str      # what +1 means
    neg_label: str      # what -1 means
    positive: tuple[str, ...]
    negative: tuple[str, ...]


# Smoothing denominator: a feature with 1 positive signal scores
# 1 / max(LOOSE_DENOM, hits) so an isolated tag gives ~0.33, not 1.0.
LOOSE_DENOM = 3


AXES: tuple[Axis, ...] = (
    Axis("pacing", "Pacing", "fast", "slow",
         positive=("fast paced", "fast-paced", "action", "action-packed",
                   "thrilling", "exciting", "frantic", "kinetic", "breathless",
                   "intense", "chase", "shootout", "thriller"),
         negative=("slow", "slow paced", "slow-paced", "contemplative", "meditative",
                   "atmospheric", "quiet", "deliberate", "leisurely")),
    Axis("tone_register", "Tone", "playful", "serious",
         positive=("comedy", "funny", "humorous", "witty", "absurd", "screwball",
                   "satirical", "satire", "lighthearted", "silly", "comic",
                   "feel good", "feel-good"),
         negative=("serious", "grim", "solemn", "somber", "sober", "heavy",
                   "tragic", "dramatic", "weighty")),
    Axis("ending_warmth", "Ending warmth", "uplifting", "bleak",
         positive=("uplifting", "feel good", "feel-good", "heartwarming",
                   "hopeful", "happy ending", "inspirational", "redemption",
                   "redemptive", "triumphant", "sweet"),
         negative=("bleak", "depressing", "downbeat", "tragic", "nihilistic",
                   "pessimistic", "hopeless", "sad ending", "tragic ending",
                   "ambiguous ending", "open ending")),
    Axis("emotional_intensity", "Emotional intensity", "intense", "detached",
         positive=("emotional", "intense", "powerful", "wrenching", "harrowing",
                   "devastating", "heart-wrenching", "moving", "touching",
                   "tearjerker", "raw", "visceral"),
         negative=("detached", "cool", "clinical", "cerebral", "cold", "distant",
                   "ironic", "deadpan", "restrained")),
    Axis("complexity", "Complexity", "cerebral", "straightforward",
         positive=("cerebral", "complex", "intricate", "labyrinthine",
                   "mind bending", "mind-bending", "puzzle", "twists and turns",
                   "non-linear", "non linear", "nonlinear", "ambiguous",
                   "philosophical", "thought provoking", "thought-provoking",
                   "intellectual", "dense", "challenging"),
         negative=("simple", "straightforward", "linear", "predictable",
                   "by the numbers", "formulaic", "conventional",
                   "easy to follow")),
    Axis("scope", "Scope", "epic", "intimate",
         positive=("epic", "sweeping", "grand", "vast", "monumental",
                   "ensemble", "blockbuster", "war", "saga", "spectacle",
                   "historical epic"),
         negative=("intimate", "small", "personal", "chamber", "minimalist",
                   "interior", "domestic", "two-hander", "low key")),
    Axis("realism", "Realism", "fantastical", "realistic",
         positive=("fantasy", "fantastical", "magical", "magic", "supernatural",
                   "surreal", "sci-fi", "sci fi", "science fiction", "futuristic",
                   "dystopian", "alternate reality", "fairy tale", "myth",
                   "mythological", "superhero", "dreamlike"),
         negative=("realistic", "naturalistic", "slice of life", "slice-of-life",
                   "documentary", "docudrama", "biographical", "true story",
                   "based on true story", "based on a true story", "kitchen sink",
                   "verite", "vérité")),
    Axis("darkness", "Darkness", "dark", "light",
         positive=("dark", "disturbing", "unsettling", "creepy", "macabre",
                   "violent", "brutal", "graphic", "horror", "gore", "twisted",
                   "sinister", "menacing", "noir"),
         negative=("light", "lighthearted", "cheerful", "wholesome", "sunny",
                   "family friendly", "family-friendly", "innocent", "gentle",
                   "warm")),
    Axis("thematic_weight", "Thematic weight", "philosophical", "escapist",
         positive=("philosophical", "philosophy", "existential", "existentialism",
                   "spiritual", "religious", "meaningful", "profound",
                   "thought provoking", "thought-provoking", "morality",
                   "ethical", "metaphysical", "introspective"),
         negative=("escapist", "popcorn", "entertaining", "fun", "guilty pleasure",
                   "lightweight", "frivolous", "summer movie")),
    Axis("character_focus", "Character focus", "singular", "ensemble",
         positive=("character study", "character-driven", "character driven",
                   "introspective", "biographical", "biopic", "one-man",
                   "protagonist focused", "intimate character"),
         negative=("ensemble", "ensemble cast", "multiple storylines",
                   "interconnected", "anthology", "hyperlink cinema",
                   "multi-protagonist")),
    Axis("moral_clarity", "Moral clarity", "clear", "ambiguous",
         positive=("good vs evil", "heroic", "moral", "righteous", "clear-cut",
                   "uplifting", "redemption", "inspirational", "noble"),
         negative=("morally ambiguous", "ambiguous", "anti-hero", "antihero",
                   "grey morality", "moral ambiguity", "nihilistic", "cynical",
                   "complex morality", "shades of grey")),
    Axis("structure", "Structure", "unconventional", "conventional",
         positive=("non-linear", "non linear", "nonlinear", "experimental",
                   "fragmented", "fractured", "unconventional", "avant-garde",
                   "art house", "art-house", "arthouse", "meta", "metafictional",
                   "unreliable narrator", "twist ending", "ambiguous ending"),
         negative=("conventional", "traditional", "formulaic", "classical",
                   "straightforward", "linear", "by the numbers")),
)


def collect_text(scraped: dict) -> list[str]:
    """Pull every tag-ish string off a scraped film record, lower-cased."""
    out: list[str] = []
    for t in scraped.get("tags", []) or []:
        if isinstance(t, dict) and t.get("name"):
            out.append(str(t["name"]).lower())
    groups = scraped.get("tag_groups_text", {}) or {}
    for vals in groups.values():
        out.extend(str(v).lower() for v in (vals or []))
    for g in scraped.get("genres", []) or []:
        out.append(str(g).lower())
    return out


def _count_hits(corpus: Iterable[str], terms: Iterable[str]) -> int:
    """Count how many distinct terms appear in any corpus item.

    Substring match so that 'feel good' picks up both 'feel good' and
    'feel-good movies'. Each term counted at most once per film.
    """
    hits = 0
    corpus_lc = [c.lower() for c in corpus]
    for term in terms:
        if any(term in c for c in corpus_lc):
            hits += 1
    return hits


def score_axis(corpus: list[str], axis: Axis) -> float:
    pos = _count_hits(corpus, axis.positive)
    neg = _count_hits(corpus, axis.negative)
    if pos == 0 and neg == 0:
        return 0.0
    denom = max(LOOSE_DENOM, pos + neg)
    return max(-1.0, min(1.0, (pos - neg) / denom))


def feature_vector(scraped: dict) -> dict[str, float]:
    corpus = collect_text(scraped)
    return {axis.key: round(score_axis(corpus, axis), 3) for axis in AXES}


def axis_keys() -> list[str]:
    return [a.key for a in AXES]
