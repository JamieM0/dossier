# Vision

This is the long-term reason Dossier exists, kept separate from `README.md`
so the current build's scope and the ultimate ambition don't get confused
with each other. **Nothing in this document is in scope right now.** It
exists so the project doesn't drift away from its own purpose while it's
being built incrementally.

## The dream

A private, user-owned model of a person's preferences — built from their own
signal, held locally, useful to them directly, never a product sold to
advertisers. Not a generic "recommendation engine," a model of *taste* that
the person actually controls: they can see what it thinks it knows, correct
it, and take it with them.

The first version of Dossier tried to build this directly and broadly: ingest
a Google Takeout export, run it through an LLM, infer a rich personality
profile (the old `design_docs/` in `archive/`, including a HEXACO/Schwartz-
style trait taxonomy), and mediate disclosure of that profile to other
services via a consent layer. It didn't work — the ingestion surface was too
large and messy, inference quality on unstructured personal data was
unreliable, and most of the build effort went into consent/disclosure
infrastructure for a profile that didn't exist yet. It was rebuilt from
scratch (see `CHANGELOG.md`) around a narrower, provable loop instead.

## The current approach: prove it on one domain first

Dossier today is a movie/TV taste engine: a small, hand-authored, deterministic
"lens" maps any title to a feature vector (pacing, tone, complexity, etc.),
and a recommender learns a person's taste purely from their own ratings —
no LLM, no ingested data dump, no inference step that can quietly be wrong.
It is useful entirely on its own terms, with no dependency on the bigger
ambition ever being realized.

This isn't a retreat from the dream — it's the first proof of the pattern
the dream depends on:

- a **lens**: a structured way to describe items in a domain along axes that
  matter to taste,
- a **calibration loop**: cheap, explicit, low-friction signal from the user
  (rating, ranking, comparing) rather than inferred from messy data,
- a **local-first, user-owned profile**: nothing leaves the device unless
  the user explicitly exports it.

If this pattern holds for entertainment, the natural next step — not now,
but eventually — is repeating it in another domain (books, games, music,
whatever's actually useful) as its own complete, standalone thing, reusing
the store/recommender/UI infrastructure that already exists. Only once
several domains have independently proven the pattern does it make sense to
ask whether there's real shared signal worth merging into something bigger —
a genuine cross-domain taste/personality model, owned by the user, portable
across services. That question is deliberately *not* being answered up
front this time. It's earned by working software, not designed before any
of it exists.

## What this means in practice

- Don't reintroduce ingestion pipelines, consent/disclosure infrastructure,
  or LLM-based inference because the original docs described them. They
  were tried and explicitly abandoned; see `archive/design_docs/` and the
  "Phase 1: Cleanup" entry in `CHANGELOG.md` for why.
- Do keep the domain layer (`packages/domain`) and the lens/recommender
  pattern generic enough that a second medium could reuse them without a
  rewrite — that reusability *is* the path to the bigger vision, not a
  separate "Layer 2" architecture to design in advance.
- When evaluating a new feature, the question is "does this make the current
  domain's taste model better or does it expand who can use it" — not "does
  this move us toward the grand unified profile." The grand version is a
  consequence of doing the narrow version well several times, not a
  checklist to build toward directly.
