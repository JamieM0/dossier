import { assess, average, key, random, round } from "./hard-metrics.mjs";

export function assessReal(scores, candidates, ratings, available = true) {
  const result = assess(scores, candidates, ratings, available);
  const likes = candidates.filter((item) => ratings[key(item)] > 0);
  const dislikes = candidates.filter((item) => ratings[key(item)] < 0);
  const pairs = [];
  for (const liked of likes) for (const disliked of dislikes) {
    if (liked.voteAverage == null || disliked.voteAverage == null || Math.abs(liked.voteAverage - disliked.voteAverage) > .5 + 1e-9) continue;
    const difference = (scores[key(liked)] ?? 0) - (scores[key(disliked)] ?? 0);
    pairs.push(difference > 0 ? 1 : difference < 0 ? 0 : .5);
  }
  return { ...result, similarPublicRatingAuc: pairs.length ? round(average(pairs)) : null, similarPublicRatingPairs: pairs.length };
}

export function meanInterval(values, seed = 719, repetitions = 5000) {
  if (!values.length) return { mean: null, lower: null, upper: null, viewers: 0 };
  const next = random(seed);
  const draws = [];
  for (let iteration = 0; iteration < repetitions; iteration++) {
    draws.push(average(Array.from({ length: values.length }, () => values[Math.floor(next() * values.length)])));
  }
  draws.sort((a, b) => a - b);
  return { mean: round(average(values)), lower: round(draws[Math.floor(repetitions * .025)]),
    upper: round(draws[Math.floor(repetitions * .975)]), viewers: values.length };
}
