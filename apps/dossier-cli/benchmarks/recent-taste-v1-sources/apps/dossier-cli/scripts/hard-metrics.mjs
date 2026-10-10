export const key = (item) => `${item.medium}:${item.id}`;
export const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const round = (value, digits = 4) => Number(value.toFixed(digits));

export function random(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}

export function shuffled(values, seed) {
  const output = [...values], next = random(seed);
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (const axis of Object.keys(a)) { dot += a[axis] * b[axis]; aa += a[axis] ** 2; bb += b[axis] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export function baselineScores(name, observed, candidates, seed) {
  const genre = new Map();
  const axes = Object.keys(candidates[0].features);
  const vector = Object.fromEntries(axes.map((axis) => [axis, 0]));
  for (const { item, rating } of observed) {
    for (const tag of item.genres) {
      const previous = genre.get(tag) ?? { sum: 0, count: 0 };
      genre.set(tag, { sum: previous.sum + rating / 3, count: previous.count + 1 });
    }
    for (const axis of axes) vector[axis] += item.features[axis] * rating / 3;
  }
  return Object.fromEntries(candidates.map((item) => {
    let score = 0;
    if (name === "popularity") score = item.popularity ?? 0;
    else if (name === "genre") score = average(item.genres.map((tag) => {
      const entry = genre.get(tag);
      return entry ? entry.sum / (entry.count + 2) : 0;
    }));
    else if (name === "vector") score = axes.reduce((total, axis) => total + item.features[axis] * vector[axis], 0) / Math.max(1, observed.length);
    else if (name === "nearest") {
      const liked = observed.filter((entry) => entry.rating > 0).map((entry) => cosine(item.features, entry.item.features));
      const disliked = observed.filter((entry) => entry.rating < 0).map((entry) => cosine(item.features, entry.item.features));
      score = (liked.length ? Math.max(...liked) : 0) - .6 * (disliked.length ? Math.max(...disliked) : 0);
    } else if (name === "random") {
      let state = (seed ^ item.id) >>> 0;
      state = Math.imul(state ^ (state >>> 16), 0x7feb352d);
      state = Math.imul(state ^ (state >>> 15), 0x846ca68b);
      score = ((state ^ (state >>> 16)) >>> 0) / 4294967296;
    } else throw new Error(`Unknown baseline: ${name}`);
    return [key(item), score];
  }));
}

export function assess(scores, candidates, ratings, available = true) {
  const ordered = [...candidates].sort((a, b) => (scores[key(b)] ?? 0) - (scores[key(a)] ?? 0) || key(a).localeCompare(key(b)));
  const positive = candidates.filter((item) => ratings[key(item)] > 0);
  const negative = candidates.filter((item) => ratings[key(item)] < 0);
  const pairs = positive.flatMap((good) => negative.map((bad) => {
    const delta = (scores[key(good)] ?? 0) - (scores[key(bad)] ?? 0);
    return delta > 0 ? 1 : delta < 0 ? 0 : .5;
  }));
  const ranked = available ? ordered : [];
  const top = ranked.slice(0, 10);
  const gain = (item) => Math.max(0, ratings[key(item)] ?? 0) / 3;
  const dcg = (rows) => rows.reduce((total, item, index) => total + (2 ** gain(item) - 1) / Math.log2(index + 2), 0);
  const ideal = [...candidates].sort((a, b) => gain(b) - gain(a)).slice(0, 10);
  const bottom = ranked.slice(-10);
  return {
    auc: round(pairs.length ? average(pairs) : .5),
    precision10: round(top.filter((item) => ratings[key(item)] > 0).length / 10),
    recall10: round(top.filter((item) => ratings[key(item)] > 0).length / Math.max(1, Math.min(10, positive.length))),
    ndcg10: round(dcg(ideal) ? dcg(top) / dcg(ideal) : 0),
    highRankMistakes: top.filter((item) => ratings[key(item)] <= 0).length + bottom.filter((item) => ratings[key(item)] > 0).length,
    coverage: top.length / 10,
    top10: top.map(key),
    positiveHeldout: positive.length,
    negativeHeldout: negative.length
  };
}

export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] : 0;
  const mean = average(values);
  return { mean: round(mean), median: round(percentile(.5)), p10: round(percentile(.1)), p90: round(percentile(.9)), sd: round(Math.sqrt(average(values.map((value) => (value - mean) ** 2)))) };
}
